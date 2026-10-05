from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Q, F
from decimal import Decimal

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

    settled_param = request.query_params.get("settled", "false")
    show_settled = settled_param.lower() == "true"

    balance = 0

    # 1. Get all relevant splits
    relevant_splits = TransactionSplit.objects.filter(
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

    # 2. Calculate current balance using remaining amounts
    for split in relevant_splits:

        transaction = split.transaction
        remaining_amount = split.amount - split.settled_amount

        if remaining_amount <= 0:
            continue

        if transaction.payer_user == user:
            balance += remaining_amount

        elif transaction.payer_contact == contact:
            balance -= remaining_amount

    # 3. Get transactions according to selected tab
    if show_settled:
        splits = relevant_splits.filter(
            settled_amount__gt=0
        )
    else:
        splits = relevant_splits.filter(
            settled_amount__lt=F("amount")
        )

    splits = splits.select_related(
        "transaction",
        "transaction__payer_user",
        "transaction__payer_contact"
    )

    # 4. Build transaction display data
    transactions = []

    for split in splits:

        transaction = split.transaction
    
        remaining_amount = split.amount - split.settled_amount
        is_settled = split.settled_amount == split.amount
    
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
            "settled_amount": split.settled_amount,
            "remaining_amount": remaining_amount,
            "settled": is_settled,
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

    relevant_splits = TransactionSplit.objects.filter(
        Q(transaction__payer_user=user, contact__isnull=False)
        |
        Q(transaction__payer_contact__owner=user, user=user)
    )

    for split in relevant_splits:

        transaction = split.transaction
        remaining_amount = split.amount - split.settled_amount

        if remaining_amount <= 0:
            continue


        if transaction.payer_user == user:
            profile_balance += remaining_amount
            lend += remaining_amount

        elif transaction.payer_contact is not None:
            profile_balance -= remaining_amount
            borrow += remaining_amount

    return Response({
        "profile_balance": profile_balance,
        "lend": lend,
        "borrow": borrow,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def settle_split_view(request, split_id):

    user = request.user

    try:
        split = TransactionSplit.objects.select_related(
            "transaction",
            "contact",
            "user",
            "transaction__payer_user",
            "transaction__payer_contact",
        ).get(id=split_id)

    except TransactionSplit.DoesNotExist:
        return Response(
            {"error": "Split not found."},
            status=404
        )

    transaction = split.transaction

    # Authorization
    valid = (
        transaction.payer_user == user
        and split.contact is not None
        and split.contact.owner == user
    ) or (
        transaction.payer_contact is not None
        and transaction.payer_contact.owner == user
        and split.user == user
    )

    if not valid:
        return Response(
            {"error": "You are not authorized to settle this split."},
            status=403
        )

    remaining_amount = split.amount - split.settled_amount

    if remaining_amount <= 0:
        return Response(
            {"error": "This split is already fully settled."},
            status=400
        )

    complete = request.data.get("complete", False)

    if complete:
        split.settled_amount = split.amount

    else:
        amount = request.data.get("amount")

        if amount is None:
            return Response(
                {"error": "Settlement amount is required."},
                status=400
            )

        try:
            amount = Decimal(str(amount))
        except (ValueError, TypeError):
            return Response(
                {"error": "Invalid settlement amount."},
                status=400
            )

        if amount <= 0:
            return Response(
                {"error": "Settlement amount must be greater than zero."},
                status=400
            )

        if amount > remaining_amount:
            return Response(
                {"error": "Settlement amount cannot exceed the remaining amount."},
                status=400
            )

        split.settled_amount += amount

    split.save(update_fields=["settled_amount"])

    return Response({
        "message": "Split settled successfully.",
        "split_id": split.id,
        "amount": split.amount,
        "settled_amount": split.settled_amount,
        "remaining_amount": split.amount - split.settled_amount,
        "settled": split.settled_amount == split.amount,
    })

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def unsettle_split_view(request, split_id):

    user = request.user

    try:
        split = TransactionSplit.objects.select_related(
            "transaction",
            "contact",
            "user",
            "transaction__payer_user",
            "transaction__payer_contact",
        ).get(id=split_id)

    except TransactionSplit.DoesNotExist:
        return Response(
            {"error": "Split not found."},
            status=404
        )

    transaction = split.transaction

    # Authorization
    valid = (
        transaction.payer_user == user
        and split.contact is not None
        and split.contact.owner == user
    ) or (
        transaction.payer_contact is not None
        and transaction.payer_contact.owner == user
        and split.user == user
    )

    if not valid:
        return Response(
            {"error": "You are not authorized to unsettle this split."},
            status=403
        )

    split.settled_amount = 0
    split.save(update_fields=["settled_amount"])

    return Response({
        "message": "Split unsettled successfully.",
        "split_id": split.id,
        "amount": split.amount,
        "settled_amount": split.settled_amount,
        "remaining_amount": split.amount,
        "settled": False,
    })