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

    balance = 0
    transactions =[]

    splits = TransactionSplit.objects.filter(
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

    for split in splits:

        transaction = split.transaction
        
        if transaction.payer_user == user:
            amount = split.amount
            paid_by = user.username
            balance += split.amount

        elif transaction.payer_contact == contact:
            amount = -split.amount
            paid_by = contact.name
            balance -= split.amount

        transactions.append({
            "id": transaction.id,
            "amount": amount,
            "date": transaction.transaction_datetime,
            "paid_by": paid_by,
            "note" : transaction.note,
        })

    return Response({
        "contact_id": contact.id,
        "contact_name": contact.name,
        "balance": balance,
        "transactions": transactions,
    })