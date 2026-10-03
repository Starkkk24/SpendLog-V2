from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Q

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Contact, Transaction, TransactionSplit
from .serializers import ContactSerializer, SignupSerializer, TransactionSerializer

from django.shortcuts import get_object_or_404

class LoginAPI(APIView):
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)

        if user is not None:
            refresh = RefreshToken.for_user(user)

            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh)
            })

        return Response({"error": "Invalid credentials"}, status=401)

class SignupAPI(APIView):
    def post(self, request):
        serializer = SignupSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()

            return Response(
                {"message":"User created successfully"},
                status=201
            )
        return Response(
            serializer.errors,
            status=400
        )
    


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_view(request):
    return Response({
        "message": "You are logged in",
        "id": request.user.id,
        "user": request.user.username
    })

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

class LogoutAPI(APIView):
    def post(self, request):
        refresh_token = request.data.get("refresh")

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Logged out"})
        except:
            return Response({"error": "Invalid token"}, status=400)


@api_view(["GET","POST"])
@permission_classes([IsAuthenticated])
def contact_list(request):
    if request.method == 'GET':
        contacts = Contact.objects.filter(owner=request.user)
        serializer = ContactSerializer(contacts, many=True)
        return Response(serializer.data)
    elif request.method == "POST":
        serializer = ContactSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(owner=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def contact_detail(request, pk):
    contact = get_object_or_404(
         Contact,
         id=pk,
         owner=request.user
    )
    if request.method == "GET":
        serializer = ContactSerializer(contact)
        return Response(serializer.data)
    elif request.method == "PATCH":
        serializer = ContactSerializer(
            contact,
            data = request.data,
            partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=200)
        return Response(serializer.errors, status=400)
    elif request.method == "DELETE":
        contact.delete()
        return Response(status=204)



@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def transaction_list(request):

    if request.method == "GET":

        transactions = Transaction.objects.filter(
            Q(payer_user=request.user) |
            Q(payer_contact__owner=request.user)
        ).prefetch_related("splits")

        serializer = TransactionSerializer(
            transactions,
            many=True
        )

        return Response(serializer.data)

    elif request.method == "POST":

        serializer = TransactionSerializer(
            data=request.data,
            context={"request": request}
        )

        if serializer.is_valid():
            transaction_obj = serializer.save()

            return Response(
                TransactionSerializer(transaction_obj).data,
                status=201
            )

        return Response(
            serializer.errors,
            status=400
        )

@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def transaction_detail(request, pk):

    transaction_obj = get_object_or_404(
        Transaction.objects.filter(
            Q(payer_user=request.user) |
            Q(payer_contact__owner=request.user)
        ),
        id=pk
    )

    if request.method == "GET":
        serializer = TransactionSerializer(transaction_obj)
        return Response(serializer.data)

    elif request.method == "PATCH":
        serializer = TransactionSerializer(
            transaction_obj,
            data=request.data,
            partial=True,
            context={"request": request}
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=200)

        return Response(serializer.errors, status=400)

    elif request.method == "DELETE":
        transaction_obj.delete()
        return Response(status=204)

# 30-09-2026
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def balance_view(request, pk):

    user = request.user

    contact = Contact.objects.get(
        id=pk,
        owner=user
    )


    transactions = []

    settled_param = request.query_params.get("settled", "false")
    show_settled = settled_param.lower() == "true"

    balance = 0

    # 1. Calculate balance ONLY from unsettled splits
    unsettled_splits = TransactionSplit.objects.filter(
        settled=False
    ).filter(
        Q(
            transaction__payer_user=user,
            contact=contact
        )
        |
        Q(
            transaction__payer_contact=contact,
            user=user
        )
    )

    for split in unsettled_splits:
        transaction = split.transaction

        if transaction.payer_user == user:
            balance += split.amount

        elif transaction.payer_contact == contact:
            balance -= split.amount


    # 2. Get transactions according to selected tab
    splits = TransactionSplit.objects.filter(
        settled=show_settled
    ).filter(
        Q(
            transaction__payer_user=user,
            contact=contact
        )
        |
        Q(
            transaction__payer_contact=contact,
            user=user
        )
    ).select_related(
        "transaction",
        "transaction__payer_user",
        "transaction__payer_contact"
    )


    # 3. Build transaction display data
    transactions = []

    for split in splits:

        transaction = split.transaction

        if transaction.payer_user == user:
            amount = split.amount
            paid_by = user.username

        elif transaction.payer_contact == contact:
            amount = -split.amount
            paid_by = contact.name

        transactions.append({
            "id": transaction.id,
            "split_id": split.id,
            "amount": amount,
            "date": transaction.transaction_datetime,
            "paid_by": paid_by,
            "note": transaction.note,
            "settled": split.settled,
        })

    return Response({
        "contact_id": contact.id,
        "contact_name": contact.name,
        "balance": balance,
        "transactions": transactions,
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_balance_view(request):

    user = request.user
    profile_balance = 0
    lend = 0
    borrow = 0

    unsettled_splits = TransactionSplit.objects.filter(
        settled=False
    ).filter(
        Q(transaction__payer_user=user, contact__isnull=False)
        |
        Q(transaction__payer_contact__owner=user, user=user)
    )

    for split in unsettled_splits:
        transaction = split.transaction

        if transaction.payer_user == user:
            profile_balance += split.amount
            lend += split.amount

        elif transaction.payer_contact is not None:
            profile_balance -= split.amount
            borrow -= split.amount

    return Response({
        "profile_balance": profile_balance,
        "lend": lend,
        "borrow": borrow,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def settle_split_view(request, pk):

    user = request.user

    try:
        split = TransactionSplit.objects.select_related(
            "transaction",
            "contact",
            "user",
            "transaction__payer_user",
            "transaction__payer_contact",
        ).get(id=pk)
    except TransactionSplit.DoesNotExist:
        return Response(
            {"error": "Split not found."},
            status=404
        )

    transaction = split.transaction

    # Check that this split belongs to a transaction
    # involving the current user and their contact.
    valid = (
        transaction.payer_user == user
        and split.contact is not None
        and split.contact.owner == user
    ) or (
        transaction.payer_contact is not None
        and transaction.payer_contact.owner == user
        and split.user == user
    )

    # print("CURRENT USER:", user.id, user.username)
    # print("PAYER USER:", transaction.payer_user_id)
    # print("PAYER CONTACT:", transaction.payer_contact_id)
    # print("SPLIT USER:", split.user_id)
    # print("SPLIT CONTACT:", split.contact_id)

    if not valid:
        return Response(
            {"error": "You are not authorized to settle this split."},
            status=403
        )

    # print("========== SETTLEMENT DEBUG ==========")
    # print("CURRENT USER:", user.id, user.username)
    # print("TRANSACTION:", split.transaction_id)
    # print("PAYER USER:", split.transaction.payer_user_id)
    # print("PAYER CONTACT:", split.transaction.payer_contact_id)
    # print("SPLIT USER:", split.user_id)
    # print("SPLIT CONTACT:", split.contact_id)
    # print("CONTACT OWNER:", split.contact.owner_id if split.contact else None)
    # print("SETTLED:", split.settled)
    # print("======================================")
    split.settled = not split.settled
    split.save(update_fields=["settled"])

    return Response({
        "message": "Split settled successfully.",
        "split_id": split.id,
        "settled": split.settled,
    })

