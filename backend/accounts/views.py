from django.shortcuts import render
from django.contrib.auth.models import User
from django.db import transaction as db_transaction
from django.db.models import F, Q
from decimal import Decimal

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Contact, Transaction, TransactionSplit, IndividualTransaction
from .serializers import ContactSerializer, SignupSerializer, TransactionSerializer, IndividualTransactionSerializer

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime





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
    
        if TransactionSplit.objects.filter(contact=contact).exists():
            return Response(
                {
                    "error": (
                        "This contact cannot be deleted because "
                        "they are part of existing transactions."
                    )
                },
                status=400
            )
    
        contact.delete()
        return Response(status=204)



def get_user_transactions(user):
    # Loads everything TransactionSerializer reads, so the
    # query count stays constant regardless of row count.
    return Transaction.objects.filter(
        Q(payer_user=user) |
        Q(payer_contact__owner=user)
    ).select_related(
        "payer_user",
        "payer_contact"
    ).prefetch_related(
        "splits__user",
        "splits__contact"
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def transaction_list(request):

    if request.method == "GET":

        transactions = get_user_transactions(request.user)

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

            transaction_obj = get_user_transactions(
                request.user
            ).get(id=transaction_obj.id)

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
        get_user_transactions(request.user),
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

            # Re-fetch: the prefetched splits are stale after
            # update() creates or deletes splits.
            transaction_obj = get_user_transactions(
                request.user
            ).get(id=pk)

            return Response(
                TransactionSerializer(transaction_obj).data,
                status=200
            )

        return Response(serializer.errors, status=400)

    elif request.method == "DELETE":
        transaction_obj.delete()
        return Response(status=204)

def contact_splits(user, contact):
    # Splits where one side paid and the other owes their share.
    return TransactionSplit.objects.filter(
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


def contact_ledger(user, contact):
    """
    Every expense split and individual transaction between the user and
    a contact, newest first. `amount` is positive when the contact owes
    the user and negative when the user owes the contact.
    """

    # 1. Get all relevant expense splits.
    #    Each split row is read once, so the query count
    #    does not grow with the number of transactions.
    relevant_splits = contact_splits(
        user,
        contact
    ).select_related("transaction")

    # 2. Get all individual transactions
    all_individual_transactions = IndividualTransaction.objects.filter(
        contact=contact
    )

    rows = []

    # Existing expense transactions
    for split in relevant_splits:

        transaction = split.transaction

        if transaction.payer_user_id == user.id:
            amount = split.amount
            paid_by = user.username

        else:
            amount = -split.amount
            paid_by = contact.name

        rows.append({
            "id": transaction.id,
            "split_id": split.id,
            "type": "expense",
            "amount": amount,
            "date": transaction.transaction_datetime,
            "paid_by": paid_by,
            "note": transaction.note,
            "settled_amount": split.settled_amount,
            "remaining_amount": split.amount - split.settled_amount,
            "settled": split.settled_amount == split.amount,
        })

    # Individual lend/borrow transactions
    for individual_transaction in all_individual_transactions:

        if individual_transaction.direction == "lend":
            amount = individual_transaction.amount
            paid_by = user.username

        else:
            amount = -individual_transaction.amount
            paid_by = contact.name

        rows.append({
            "id": individual_transaction.id,
            "individual_transaction_id": individual_transaction.id,
            "type": "individual",
            "direction": individual_transaction.direction,
            "amount": amount,
            "date": individual_transaction.transaction_datetime,
            "paid_by": paid_by,
            "note": individual_transaction.note,
            "settled_amount": individual_transaction.settled_amount,
            "remaining_amount": (
                individual_transaction.amount
                - individual_transaction.settled_amount
            ),
            "settled": (
                individual_transaction.settled_amount
                == individual_transaction.amount
            ),
        })

    # 3. Sort combined transactions newest first
    rows.sort(
        key=lambda row: row["date"],
        reverse=True
    )

    return rows


def ledger_balance(rows):
    # Only the unsettled part of each row counts toward the balance.
    return sum(
        (
            row["remaining_amount"] if row["amount"] > 0
            else -row["remaining_amount"]
        )
        for row in rows
        if row["remaining_amount"] > 0
    )


# 30-09-2026
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def balance_view(request, pk):

    user = request.user

    contact = get_object_or_404(
        Contact,
        id=pk,
        owner=user
    )

    settled_param = request.query_params.get("settled", "false")
    show_settled = settled_param.lower() == "true"

    rows = contact_ledger(user, contact)

    # Filter for selected tab. Partially settled rows appear in both.
    if show_settled:
        transactions = [row for row in rows if row["settled_amount"] > 0]
    else:
        transactions = [row for row in rows if row["remaining_amount"] > 0]

    return Response({
        "contact_id": contact.id,
        "contact_name": contact.name,
        "balance": ledger_balance(rows),
        "transactions": transactions,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def settle_contact_view(request, pk):
    """
    Fully settles every unsettled split and individual transaction
    with a contact, bringing the net balance to zero.
    """

    user = request.user

    contact = get_object_or_404(
        Contact,
        id=pk,
        owner=user
    )

    with db_transaction.atomic():
        settled_balance = ledger_balance(
            contact_ledger(user, contact)
        )

        splits_settled = contact_splits(
            user,
            contact
        ).filter(
            settled_amount__lt=F("amount")
        ).update(
            settled_amount=F("amount")
        )

        individual_settled = IndividualTransaction.objects.filter(
            contact=contact,
            settled_amount__lt=F("amount")
        ).update(
            settled_amount=F("amount")
        )

        if splits_settled == 0 and individual_settled == 0:
            return Response(
                {"error": "Nothing to settle."},
                status=400
            )

    return Response({
        "message": "Balance settled successfully.",
        "settled_balance": settled_balance,
        "splits_settled": splits_settled,
        "individual_settled": individual_settled,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def statement_view(request, pk):
    """
    Rows for a shareable statement.

    ?status=unsettled|settled|all  (default unsettled; settled means fully settled)
    ?from=<ISO datetime>&to=<ISO datetime>  (optional, from inclusive, to exclusive)
    """

    user = request.user

    contact = get_object_or_404(
        Contact,
        id=pk,
        owner=user
    )

    status = request.query_params.get("status", "unsettled")
    if status not in ("unsettled", "settled", "all"):
        return Response({"error": "Invalid status."}, status=400)

    bounds = {}
    for param in ("from", "to"):
        value = request.query_params.get(param)
        if not value:
            continue

        parsed = parse_datetime(value)
        if parsed is None or timezone.is_naive(parsed):
            return Response(
                {"error": f"'{param}' must be an ISO datetime with a timezone."},
                status=400,
            )
        bounds[param] = parsed

    rows = contact_ledger(user, contact)

    if status == "unsettled":
        rows = [row for row in rows if not row["settled"]]
    elif status == "settled":
        rows = [row for row in rows if row["settled"]]

    if "from" in bounds:
        rows = [row for row in rows if row["date"] >= bounds["from"]]
    if "to" in bounds:
        rows = [row for row in rows if row["date"] < bounds["to"]]

    return Response({
        "contact_id": contact.id,
        "contact_name": contact.name,
        "balance": ledger_balance(rows),
        "transactions": rows,
    })



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_balance_view(request):
        user = request.user

        # Net remaining amount per contact; positive means they owe the user.
        contacts = {}

        def add(contact, amount):
            entry = contacts.setdefault(contact.id, {
                "id": contact.id,
                "name": contact.name,
                "balance": 0,
                "open_count": 0,
            })
            entry["balance"] += amount
            entry["open_count"] += 1

        relevant_splits = (
            TransactionSplit.objects
            .filter(
                Q(transaction__payer_user=user, contact__isnull=False)
                |
                Q(transaction__payer_contact__owner=user, user=user)
            )
            .select_related(
                "contact",
                "transaction",
                "transaction__payer_contact",
            )
        )

        for split in relevant_splits:
            transaction = split.transaction
            remaining_amount = split.amount - split.settled_amount

            if remaining_amount <= 0:
                continue

            if transaction.payer_user_id == user.id:
                add(split.contact, remaining_amount)

            elif transaction.payer_contact is not None:
                add(transaction.payer_contact, -remaining_amount)

        individual_transactions = (
            IndividualTransaction.objects
            .filter(contact__owner=user)
            .select_related("contact")
        )

        for transaction in individual_transactions:
            remaining_amount = (
                transaction.amount - transaction.settled_amount
            )

            if remaining_amount <= 0:
                continue

            if transaction.direction == "lend":
                add(transaction.contact, remaining_amount)

            elif transaction.direction == "borrow":
                add(transaction.contact, -remaining_amount)

        # Contacts whose items cancel out are settled up, so they're left out.
        balances = sorted(
            (entry for entry in contacts.values() if entry["balance"] != 0),
            key=lambda entry: -abs(entry["balance"]),
        )

        # Lent/borrow are net per contact, so they add up to the lists.
        lend = sum(entry["balance"] for entry in balances if entry["balance"] > 0)
        borrow = -sum(entry["balance"] for entry in balances if entry["balance"] < 0)

        return Response({
            "profile_balance": lend - borrow,
            "lend": lend,
            "borrow": borrow,
            "contacts": balances,
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

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def individual_transaction_list(request, contact_id):

    user = request.user

    try:
        contact = Contact.objects.get(
            id=contact_id,
            owner=user
        )
    except Contact.DoesNotExist:
        return Response(
            {"error": "Contact not found."},
            status=404
        )

    if request.method == "GET":

        transactions = IndividualTransaction.objects.filter(
            contact=contact
        ).order_by(
            "-transaction_datetime",
            "-created_at"
        )

        serializer = IndividualTransactionSerializer(
            transactions,
            many=True,
            context={
                "request": request,
                "contact": contact,
            }
        )

        return Response(serializer.data)

    serializer = IndividualTransactionSerializer(
        data=request.data,
        context={
            "request": request,
            "contact": contact,
        }
    )

    if serializer.is_valid():

        individual_transaction = serializer.save(
            contact=contact
        )

        return Response(
            IndividualTransactionSerializer(
                individual_transaction,
                context={
                    "request": request,
                    "contact": contact,
                }
            ).data,
            status=201
        )

    print(
        "INDIVIDUAL TRANSACTION ERRORS:",
        serializer.errors
    )

    return Response(
        serializer.errors,
        status=400
    )

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_individual_transaction_view(request, transaction_id):

    user = request.user

    try:
        individual_transaction = (
            IndividualTransaction.objects
            .select_related("contact")
            .get(
                id=transaction_id,
                contact__owner=user
            )
        )

    except IndividualTransaction.DoesNotExist:
        return Response(
            {"error": "Individual transaction not found."},
            status=404
        )

    if individual_transaction.settled_amount > 0:
        return Response(
            {
                "error": (
                    "This transaction cannot be deleted because "
                    "settlement activity has already occurred."
                )
            },
            status=400
        )

    individual_transaction.delete()

    return Response(status=204)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def settle_individual_transaction_view(request, transaction_id):

    user = request.user

    try:
        individual_transaction = (
            IndividualTransaction.objects
            .select_related("contact")
            .get(
                id=transaction_id,
                contact__owner=user
            )
        )

    except IndividualTransaction.DoesNotExist:
        return Response(
            {"error": "Individual transaction not found."},
            status=404
        )

    remaining_amount = (
        individual_transaction.amount
        - individual_transaction.settled_amount
    )

    if remaining_amount <= 0:
        return Response(
            {"error": "This transaction is already fully settled."},
            status=400
        )

    complete = request.data.get("complete", False)

    if complete:
        individual_transaction.settled_amount = (
            individual_transaction.amount
        )

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
                {
                    "error": (
                        "Settlement amount cannot exceed "
                        "the remaining amount."
                    )
                },
                status=400
            )

        individual_transaction.settled_amount += amount

    individual_transaction.save(
        update_fields=["settled_amount"]
    )

    return Response({
        "message": "Individual transaction settled successfully.",
        "transaction_id": individual_transaction.id,
        "amount": individual_transaction.amount,
        "settled_amount": individual_transaction.settled_amount,
        "remaining_amount": (
            individual_transaction.amount
            - individual_transaction.settled_amount
        ),
        "settled": (
            individual_transaction.settled_amount
            == individual_transaction.amount
        ),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def unsettle_individual_transaction_view(request, transaction_id):

    user = request.user

    try:
        individual_transaction = (
            IndividualTransaction.objects
            .select_related("contact")
            .get(
                id=transaction_id,
                contact__owner=user
            )
        )

    except IndividualTransaction.DoesNotExist:
        return Response(
            {"error": "Individual transaction not found."},
            status=404
        )

    individual_transaction.settled_amount = 0

    individual_transaction.save(
        update_fields=["settled_amount"]
    )

    return Response({
        "message": "Individual transaction unsettled successfully.",
        "transaction_id": individual_transaction.id,
        "amount": individual_transaction.amount,
        "settled_amount": 0,
        "remaining_amount": individual_transaction.amount,
        "settled": False,
    })