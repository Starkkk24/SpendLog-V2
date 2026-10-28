from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIRequestFactory, APITestCase

from .models import Contact, IndividualTransaction, Transaction, TransactionSplit
from .serializers import IndividualTransactionSerializer


class TransactionQueryCountTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user("owner", password="x")
        self.contacts = [
            Contact.objects.create(owner=self.user, name=f"c{i}")
            for i in range(6)
        ]
        self.client.force_authenticate(self.user)

    def create_transaction(self, contact_count, payer_is_user=True):
        contacts = self.contacts[:contact_count]
        transaction_obj = Transaction.objects.create(
            payer_user=self.user if payer_is_user else None,
            payer_contact=None if payer_is_user else contacts[0],
            total_amount=Decimal(10) * (contact_count + 1),
            transaction_datetime=timezone.now(),
        )
        TransactionSplit.objects.create(
            transaction=transaction_obj,
            user=self.user,
            amount=10,
            settled_amount=10 if payer_is_user else 0,
        )
        for index, contact in enumerate(contacts):
            TransactionSplit.objects.create(
                transaction=transaction_obj,
                contact=contact,
                amount=10,
                settled_amount=10 if (not payer_is_user and index == 0) else 0,
            )
        return transaction_obj

    def count_queries(self, path):
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(path)
        self.assertEqual(response.status_code, 200)
        return len(ctx.captured_queries)

    def test_list_query_count_is_constant(self):
        for i in range(5):
            self.create_transaction(2, payer_is_user=i % 2 == 0)
        small = self.count_queries("/transactions/")

        for i in range(45):
            self.create_transaction(2, payer_is_user=i % 2 == 0)
        large = self.count_queries("/transactions/")

        self.assertEqual(small, large)
        self.assertLessEqual(large, 4)

    def test_detail_query_count_is_constant(self):
        few = self.create_transaction(1)
        many = self.create_transaction(5)

        few_count = self.count_queries(f"/transactions/{few.id}/")
        many_count = self.count_queries(f"/transactions/{many.id}/")

        self.assertEqual(few_count, many_count)
        self.assertLessEqual(many_count, 4)

    def test_list_payload_values(self):
        self.create_transaction(1, payer_is_user=True)
        self.create_transaction(1, payer_is_user=False)

        response = self.client.get("/transactions/")
        by_payer = {
            row["payer_user_name"] or row["payer_contact_name"]: row
            for row in response.data
        }

        user_paid = by_payer["owner"]
        self.assertIsNone(user_paid["payer_contact_name"])
        self.assertEqual(user_paid["remaining_amount"], Decimal("10.00"))
        names = {
            split["user_name"] or split["contact_name"]: split
            for split in user_paid["splits"]
        }
        self.assertEqual(set(names), {"owner", "c0"})
        self.assertTrue(names["owner"]["settled"])
        self.assertFalse(names["c0"]["settled"])
        self.assertEqual(names["c0"]["remaining_amount"], Decimal("10.00"))

        contact_paid = by_payer["c0"]
        self.assertIsNone(contact_paid["payer_user_name"])
        self.assertEqual(contact_paid["remaining_amount"], Decimal("10.00"))

    def test_patch_response_reflects_new_and_removed_splits(self):
        transaction_obj = self.create_transaction(2)
        alice, bob, carol = self.contacts[0], self.contacts[1], self.contacts[2]

        response = self.client.patch(
            f"/transactions/{transaction_obj.id}/",
            {
                "total_amount": "40.00",
                "splits": [
                    {"user": self.user.id, "contact": None, "amount": "20.00"},
                    {"user": None, "contact": alice.id, "amount": "10.00"},
                    {"user": None, "contact": carol.id, "amount": "10.00"},
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        returned = {
            split["user_name"] or split["contact_name"]: split["amount"]
            for split in response.data["splits"]
        }
        self.assertEqual(
            returned,
            {"owner": "20.00", alice.name: "10.00", carol.name: "10.00"},
        )
        self.assertNotIn(bob.name, returned)

        stored = TransactionSplit.objects.filter(transaction=transaction_obj)
        self.assertEqual(stored.count(), 3)
        self.assertEqual(response.data["remaining_amount"], Decimal("20.00"))

    def test_create_response_includes_split_names(self):
        alice = self.contacts[0]

        response = self.client.post(
            "/transactions/",
            {
                "payer_user": self.user.id,
                "payer_contact": None,
                "total_amount": "30.00",
                "note": "",
                "transaction_datetime": "2026-01-01T10:00:00Z",
                "splits": [
                    {"user": self.user.id, "contact": None, "amount": "15.00"},
                    {"user": None, "contact": alice.id, "amount": "15.00"},
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        names = {
            split["user_name"] or split["contact_name"]
            for split in response.data["splits"]
        }
        self.assertEqual(names, {"owner", alice.name})
        self.assertEqual(response.data["payer_user_name"], "owner")


class ContactBalanceTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user("owner", password="x")
        self.contact = Contact.objects.create(owner=self.user, name="alice")
        self.other_contact = Contact.objects.create(owner=self.user, name="bob")
        self.client.force_authenticate(self.user)
        self.day = 0

    def next_datetime(self):
        self.day += 1
        return timezone.now() - timedelta(days=100 - self.day)

    def user_paid(self, contact, amount, settled):
        transaction_obj = Transaction.objects.create(
            payer_user=self.user,
            total_amount=Decimal(amount) * 2,
            transaction_datetime=self.next_datetime(),
        )
        TransactionSplit.objects.create(
            transaction=transaction_obj,
            user=self.user,
            amount=amount,
            settled_amount=amount,
        )
        return TransactionSplit.objects.create(
            transaction=transaction_obj,
            contact=contact,
            amount=amount,
            settled_amount=settled,
        )

    def contact_paid(self, contact, amount, settled):
        transaction_obj = Transaction.objects.create(
            payer_contact=contact,
            total_amount=Decimal(amount) * 2,
            transaction_datetime=self.next_datetime(),
        )
        TransactionSplit.objects.create(
            transaction=transaction_obj,
            contact=contact,
            amount=amount,
            settled_amount=amount,
        )
        return TransactionSplit.objects.create(
            transaction=transaction_obj,
            user=self.user,
            amount=amount,
            settled_amount=settled,
        )

    def individual(self, contact, direction, amount, settled):
        return IndividualTransaction.objects.create(
            contact=contact,
            direction=direction,
            amount=amount,
            settled_amount=settled,
            transaction_datetime=self.next_datetime(),
        )

    def seed_mixed(self):
        self.user_partial = self.user_paid(self.contact, 30, 10)
        self.contact_full = self.contact_paid(self.contact, 40, 40)
        self.contact_unsettled = self.contact_paid(self.contact, 25, 0)
        self.lend_partial = self.individual(self.contact, "lend", 50, 20)
        self.borrow_unsettled = self.individual(self.contact, "borrow", 10, 0)
        self.borrow_full = self.individual(self.contact, "borrow", 5, 5)

        # Noise that must never affect alice's balance.
        self.user_paid(self.other_contact, 99, 0)
        self.individual(self.other_contact, "lend", 77, 0)

    def get_balance(self, settled):
        response = self.client.get(
            f"/contacts/{self.contact.id}/balance/?settled={settled}"
        )
        self.assertEqual(response.status_code, 200)
        return response.data

    def rows_by_key(self, data):
        return {
            (row["type"], row.get("split_id") or row["individual_transaction_id"]): row
            for row in data["transactions"]
        }

    def test_balance_counts_only_remaining_amounts(self):
        self.seed_mixed()

        # +20 (user paid, 10 of 30 settled)
        # -25 (alice paid, unsettled)
        # +30 (lend, 20 of 50 settled)
        # -10 (borrow, unsettled)
        # fully settled rows contribute nothing
        for settled in ("false", "true"):
            data = self.get_balance(settled)
            self.assertEqual(data["balance"], Decimal("15.00"))
            self.assertEqual(data["contact_name"], "alice")

    def test_unsettled_tab_includes_unsettled_and_partial(self):
        self.seed_mixed()

        rows = self.rows_by_key(self.get_balance("false"))

        self.assertEqual(set(rows), {
            ("expense", self.user_partial.id),
            ("expense", self.contact_unsettled.id),
            ("individual", self.lend_partial.id),
            ("individual", self.borrow_unsettled.id),
        })

        partial = rows[("expense", self.user_partial.id)]
        self.assertEqual(partial["amount"], Decimal("30.00"))
        self.assertEqual(partial["paid_by"], "owner")
        self.assertEqual(partial["settled_amount"], Decimal("10.00"))
        self.assertEqual(partial["remaining_amount"], Decimal("20.00"))
        self.assertFalse(partial["settled"])

        owed = rows[("expense", self.contact_unsettled.id)]
        self.assertEqual(owed["amount"], Decimal("-25.00"))
        self.assertEqual(owed["paid_by"], "alice")

        borrow = rows[("individual", self.borrow_unsettled.id)]
        self.assertEqual(borrow["amount"], Decimal("-10.00"))
        self.assertEqual(borrow["direction"], "borrow")
        self.assertEqual(borrow["paid_by"], "alice")

    def test_settled_tab_includes_partial_and_full(self):
        self.seed_mixed()

        rows = self.rows_by_key(self.get_balance("true"))

        self.assertEqual(set(rows), {
            ("expense", self.user_partial.id),
            ("expense", self.contact_full.id),
            ("individual", self.lend_partial.id),
            ("individual", self.borrow_full.id),
        })

        full = rows[("expense", self.contact_full.id)]
        self.assertTrue(full["settled"])
        self.assertEqual(full["remaining_amount"], Decimal("0.00"))

        lend = rows[("individual", self.lend_partial.id)]
        self.assertEqual(lend["amount"], Decimal("50.00"))
        self.assertEqual(lend["paid_by"], "owner")
        self.assertEqual(lend["remaining_amount"], Decimal("30.00"))
        self.assertFalse(lend["settled"])

    def test_rows_sorted_newest_first(self):
        self.seed_mixed()

        for settled in ("false", "true"):
            dates = [
                row["date"]
                for row in self.get_balance(settled)["transactions"]
            ]
            self.assertEqual(dates, sorted(dates, reverse=True))

    def test_other_users_data_is_excluded(self):
        self.seed_mixed()
        stranger = User.objects.create_user("stranger", password="x")
        stranger_contact = Contact.objects.create(owner=stranger, name="alice")
        IndividualTransaction.objects.create(
            contact=stranger_contact,
            direction="lend",
            amount=500,
            transaction_datetime=timezone.now(),
        )

        self.assertEqual(self.get_balance("false")["balance"], Decimal("15.00"))

    def test_unknown_contact_returns_404(self):
        response = self.client.get("/contacts/999999/balance/?settled=false")

        self.assertEqual(response.status_code, 404)

    def test_other_users_contact_returns_404_without_data(self):
        stranger = User.objects.create_user("stranger", password="x")
        stranger_contact = Contact.objects.create(owner=stranger, name="secret")
        IndividualTransaction.objects.create(
            contact=stranger_contact,
            direction="lend",
            amount=500,
            transaction_datetime=timezone.now(),
        )

        unknown = self.client.get("/contacts/999999/balance/")

        for settled in ("false", "true"):
            response = self.client.get(
                f"/contacts/{stranger_contact.id}/balance/?settled={settled}"
            )

            self.assertEqual(response.status_code, 404)
            # Same response as a missing id, so contact existence isn't leaked.
            self.assertEqual(response.data, unknown.data)
            self.assertNotIn("secret", str(response.content))
            self.assertNotIn("500", str(response.content))

    def test_empty_contact(self):
        data = self.get_balance("false")

        self.assertEqual(data["balance"], 0)
        self.assertEqual(data["transactions"], [])

    def test_query_count_is_constant(self):
        def count(settled):
            with CaptureQueriesContext(connection) as ctx:
                self.get_balance(settled)
            return len(ctx.captured_queries)

        self.user_paid(self.contact, 30, 10)
        self.contact_paid(self.contact, 25, 25)
        self.individual(self.contact, "lend", 50, 20)
        small = {settled: count(settled) for settled in ("false", "true")}

        for i in range(20):
            self.user_paid(self.contact, 30, i % 3 * 10)
            self.contact_paid(self.contact, 25, i % 2 * 25)
            self.individual(self.contact, "borrow", 10, i % 2 * 5)
        large = {settled: count(settled) for settled in ("false", "true")}

        self.assertEqual(small, large)
        self.assertLessEqual(max(large.values()), 3)


class TransactionCreateValidationTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user("owner", password="x")
        self.contacts = [
            Contact.objects.create(owner=self.user, name=f"c{i}")
            for i in range(9)
        ]
        stranger = User.objects.create_user("stranger", password="x")
        self.foreign_contact = Contact.objects.create(
            owner=stranger,
            name="foreign"
        )
        self.client.force_authenticate(self.user)

    def payload(self, payer_contact=None, contacts=()):
        splits = [{"user": self.user.id, "contact": None, "amount": "10.00"}]
        splits += [
            {"user": None, "contact": contact.id, "amount": "10.00"}
            for contact in contacts
        ]
        return {
            "payer_user": None if payer_contact else self.user.id,
            "payer_contact": payer_contact.id if payer_contact else None,
            "total_amount": f"{10 * len(splits)}.00",
            "note": "",
            "transaction_datetime": "2026-01-01T10:00:00Z",
            "splits": splits,
        }

    def test_foreign_contact_rejected_as_payer(self):
        response = self.client.post(
            "/transactions/",
            self.payload(
                payer_contact=self.foreign_contact,
                contacts=[self.foreign_contact],
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data,
            {"payer_contact": ["You can only use your own contacts."]},
        )
        self.assertFalse(Transaction.objects.exists())

    def test_foreign_contact_rejected_as_participant(self):
        response = self.client.post(
            "/transactions/",
            self.payload(contacts=[self.contacts[0], self.foreign_contact]),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data,
            {"splits": ["You can only use your own contacts."]},
        )
        self.assertFalse(Transaction.objects.exists())

    def test_own_contact_payer_accepted(self):
        response = self.client.post(
            "/transactions/",
            self.payload(
                payer_contact=self.contacts[0],
                contacts=[self.contacts[0]],
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["payer_contact_name"], "c0")

    def test_query_count_grows_by_one_per_participant(self):
        def count(contacts):
            with CaptureQueriesContext(connection) as ctx:
                response = self.client.post(
                    "/transactions/",
                    self.payload(contacts=contacts),
                    format="json",
                )
            self.assertEqual(response.status_code, 201)
            return len(ctx.captured_queries)

        two = count(self.contacts[:1])
        ten = count(self.contacts[:9])

        # Each extra participant costs only its own primary-key lookup.
        self.assertEqual(ten - two, 8)


class IndividualTransactionValidationTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user("owner", password="x")
        self.contact = Contact.objects.create(owner=self.user, name="alice")
        stranger = User.objects.create_user("stranger", password="x")
        self.foreign_contact = Contact.objects.create(
            owner=stranger,
            name="foreign"
        )
        self.client.force_authenticate(self.user)
        self.data = {
            "direction": "lend",
            "amount": "25.00",
            "note": "",
            "transaction_datetime": "2026-01-01T10:00:00Z",
        }

    def serializer_for(self, contact):
        request = APIRequestFactory().post("/")
        request.user = self.user
        return IndividualTransactionSerializer(
            data=self.data,
            context={"request": request, "contact": contact},
        )

    def test_foreign_contact_rejected_by_api(self):
        response = self.client.post(
            f"/contacts/{self.foreign_contact.id}/individual-transactions/",
            self.data,
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data, {"error": "Contact not found."})
        self.assertFalse(IndividualTransaction.objects.exists())

    def test_foreign_contact_rejected_by_serializer(self):
        serializer = self.serializer_for(self.foreign_contact)

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            serializer.errors,
            {"contact": ["You can only use your own contacts."]},
        )

    def test_own_contact_validates_without_queries(self):
        contact = Contact.objects.get(id=self.contact.id)
        serializer = self.serializer_for(contact)

        with self.assertNumQueries(0):
            self.assertTrue(serializer.is_valid())

    def test_own_contact_created_by_api(self):
        response = self.client.post(
            f"/contacts/{self.contact.id}/individual-transactions/",
            self.data,
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["contact_name"], "alice")
