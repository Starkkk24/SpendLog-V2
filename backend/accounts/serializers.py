from rest_framework import serializers
from .models import Contact, Transaction, TransactionSplit, IndividualTransaction
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q, Sum

class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "password", "password2"]
 
    def validate(self, data):
        if data["password"] != data["password2"]:
            raise serializers.ValidationError({
                "password" : "Password do not match."
            })

        return data

    def create(self, validated_data):
        validated_data.pop("password2")

        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"]
        )

        return user

class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = "__all__"
        read_only_fields = ["owner"]


class TransactionSplitSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()

    remaining_amount = serializers.SerializerMethodField()
    settled = serializers.SerializerMethodField()

    class Meta:
        model = TransactionSplit
        fields = [
            "id",
            "user",
            "user_name",
            "contact",
            "contact_name",
            "amount",
            "settled_amount",
            "remaining_amount",
            "settled",
        ]

        read_only_fields = [
            "id",
            "settled_amount",
            "remaining_amount",
            "settled",
        ]

    def get_user_name(self, obj):
        return obj.user.username if obj.user else None

    def get_contact_name(self, obj):
        return obj.contact.name if obj.contact else None

    def get_remaining_amount(self, obj):
        return obj.amount - obj.settled_amount

    def get_settled(self, obj):
        return obj.settled_amount == obj.amount


class TransactionSerializer(serializers.ModelSerializer):
    splits = TransactionSplitSerializer(many=True)

    payer_user_name = serializers.SerializerMethodField()
    payer_contact_name = serializers.SerializerMethodField()

    remaining_amount = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id",
            "payer_user",
            "payer_user_name",
            "payer_contact",
            "payer_contact_name",
            "total_amount",
            "remaining_amount",
            "note",
            "transaction_datetime",
            "splits",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_remaining_amount(self, obj):
        return sum(
            split.amount - split.settled_amount
            for split in obj.splits.all()
        )

    def get_payer_user_name(self, obj):
        return obj.payer_user.username if obj.payer_user else None

    def get_payer_contact_name(self, obj):
        return obj.payer_contact.name if obj.payer_contact else None

    def validate(self, data):
        user = self.context["request"].user

        payer_fields_submitted = (
            "payer_user" in data or "payer_contact" in data
        )

        if self.instance and not payer_fields_submitted:
            payer_user = self.instance.payer_user
            payer_contact = self.instance.payer_contact
        else:
            payer_user = data.get("payer_user")
            payer_contact = data.get("payer_contact")

        splits = data.get("splits")

        if splits is None and self.instance:
            splits = self.instance.splits.all()
        else:
            splits = splits or []

        if "total_amount" in data:
            total_amount = data["total_amount"]
        elif self.instance:
            total_amount = self.instance.total_amount
        else:
            raise serializers.ValidationError({
                "total_amount": "This field is required."
            })

        # Exactly one payer
        if bool(payer_user) == bool(payer_contact):
            raise serializers.ValidationError(
                "Exactly one of payer_user or payer_contact must be provided."
            )

        # User can only select themselves as payer
        if payer_user and payer_user != user:
            raise serializers.ValidationError({
                "payer_user": "You can only select yourself."
            })

        # Contact payer must belong to current user
        if payer_contact and payer_contact.owner != user:
            raise serializers.ValidationError({
                "payer_contact": "You can only use your own contacts."
            })

        split_total = 0
        participants = set()

        for split in splits:
            if isinstance(split, TransactionSplit):
                split_user = split.user
                split_contact = split.contact
                split_amount = split.amount
            else:
                split_user = split.get("user")
                split_contact = split.get("contact")
                split_amount = split["amount"]

            # Exactly one participant
            if bool(split_user) == bool(split_contact):
                raise serializers.ValidationError({
                    "splits": "Each split must have exactly one user or contact."
                })

            # User participant must be current user
            if split_user:
                if split_user != user:
                    raise serializers.ValidationError({
                        "splits": "You can only use yourself as a user participant."
                    })

                participant_key = f"user:{split_user.id}"

            # Contact participant must belong to current user
            else:
                if split_contact.owner != user:
                    raise serializers.ValidationError({
                        "splits": "You can only use your own contacts."
                    })

                participant_key = f"contact:{split_contact.id}"

            # No duplicate participant
            if participant_key in participants:
                raise serializers.ValidationError({
                    "splits": "A participant cannot appear more than once."
                })

            participants.add(participant_key)
            split_total += split_amount

        payer_key = (
            f"user:{payer_user.id}"
            if payer_user
            else f"contact:{payer_contact.id}"
        )

        if payer_key not in participants:
            raise serializers.ValidationError({
                "splits": "The payer must appear exactly once in the splits."
            })

        # Split total must equal transaction total
        if split_total != total_amount:
            raise serializers.ValidationError({
                "splits": "The total of all split amounts must equal the transaction total."
            })

        return data

    def create(self, validated_data):
        splits_data = validated_data.pop("splits")

        payer_user = validated_data.get("payer_user")
        payer_contact = validated_data.get("payer_contact")

        with transaction.atomic():
            transaction_obj = Transaction.objects.create(
                **validated_data
            )

            TransactionSplit.objects.bulk_create([
                TransactionSplit(
                    transaction=transaction_obj,
                    settled_amount=split_data["amount"]
                    if (
                        (payer_user is not None and split_data.get("user") == payer_user)
                        or
                        (payer_contact is not None and split_data.get("contact") == payer_contact)
                    )
                    else 0,
                    **split_data
                )
                for split_data in splits_data
            ])

        return transaction_obj

    def update(self, instance, validated_data):
        splits_data = validated_data.pop("splits", None)

        payer_fields_submitted = (
            "payer_user" in validated_data
            or "payer_contact" in validated_data
        )

        original_payer_key = (
            ("user", instance.payer_user_id)
            if instance.payer_user_id
            else ("contact", instance.payer_contact_id)
        )

        if payer_fields_submitted:
            new_payer_user = validated_data.get("payer_user")
            new_payer_contact = validated_data.get("payer_contact")
        else:
            new_payer_user = instance.payer_user
            new_payer_contact = instance.payer_contact

        new_payer_key = (
            ("user", new_payer_user.id)
            if new_payer_user
            else ("contact", new_payer_contact.id)
        )

        payer_changed = new_payer_key != original_payer_key

        total_amount_changed = (
            "total_amount" in validated_data
            and validated_data["total_amount"] != instance.total_amount
        )

        with transaction.atomic():

            existing_splits = {
                (
                    ("user", split.user_id)
                    if split.user_id
                    else ("contact", split.contact_id)
                ): split
                for split in instance.splits.all()
            }

            # The payer's automatic settlement does NOT count
            # as real settlement activity.
            real_settlement_exists = any(
                split.settled_amount > 0
                and key != original_payer_key
                for key, split in existing_splits.items()
            )

            # ---------------------------------------------------------
            # Transaction-level locks
            # ---------------------------------------------------------

            if real_settlement_exists and total_amount_changed:
                raise serializers.ValidationError({
                    "total_amount": (
                        "The transaction total cannot be changed after "
                        "settlement activity."
                    )
                })

            if real_settlement_exists and payer_changed:
                raise serializers.ValidationError({
                    "payer": (
                        "The payer cannot be changed after settlement activity."
                    )
                })

            # ---------------------------------------------------------
            # Build incoming split map
            # ---------------------------------------------------------

            incoming_splits = {}

            if splits_data is not None:
                incoming_splits = {
                    (
                        ("user", split_data["user"].id)
                        if split_data.get("user")
                        else ("contact", split_data["contact"].id)
                    ): split_data
                    for split_data in splits_data
                }

                # New payer must be present.
                if payer_changed and new_payer_key not in incoming_splits:
                    raise serializers.ValidationError({
                        "splits": "The new payer must appear in the splits."
                    })

                # -----------------------------------------------------
                # Validate existing settled non-payer splits
                # -----------------------------------------------------

                for key, existing_split in existing_splits.items():

                    # Old payer is specially handled during payer change.
                    if payer_changed and key == original_payer_key:
                        continue

                    if existing_split.settled_amount > 0:
                        incoming_split = incoming_splits.get(key)

                        if incoming_split is None:
                            raise serializers.ValidationError({
                                "splits": (
                                    "A participant with settlement activity "
                                    "cannot be removed."
                                )
                            })

                            raise serializers.ValidationError({
                                "splits": (
                                    f"Amount for an already-settled participant cannot be changed. "
                                    f"Participant: {key}, "
                                    f"existing amount: {existing_split.amount}, "
                                    f"incoming amount: {incoming_split['amount']}"
                                )
                            })

                # -----------------------------------------------------
                # Payer amount remains editable.
                #
                # Even if another participant has settlement activity,
                # the payer's automatically-settled split is NOT locked.
                # -----------------------------------------------------

            # ---------------------------------------------------------
            # Update transaction fields
            # ---------------------------------------------------------

            for attr, value in validated_data.items():
                if attr not in ("payer_user", "payer_contact"):
                    setattr(instance, attr, value)

            if payer_fields_submitted:
                instance.payer_user = new_payer_user
                instance.payer_contact = new_payer_contact

            instance.save()

            # ---------------------------------------------------------
            # Reconcile splits
            # ---------------------------------------------------------

            if splits_data is not None:

                for key, split_data in incoming_splits.items():

                    existing_split = existing_splits.get(key)

                    # -------------------------------------------------
                    # New participant
                    # -------------------------------------------------

                    if existing_split is None:
                        TransactionSplit.objects.create(
                            transaction=instance,
                            settled_amount=(
                                split_data["amount"]
                                if key == new_payer_key
                                else 0
                            ),
                            **split_data
                        )
                        continue

                    # -------------------------------------------------
                    # Old payer -> normal splittie
                    #
                    # This is the special payer-change transition.
                    # The old payer keeps the same participant identity
                    # and amount, but loses the automatic settlement.
                    # -------------------------------------------------

                    if payer_changed and key == original_payer_key:
                        existing_split.amount = split_data["amount"]
                        existing_split.settled_amount = 0

                        existing_split.save(
                            update_fields=[
                                "amount",
                                "settled_amount",
                            ]
                        )
                        continue

                    # -------------------------------------------------
                    # New payer
                    #
                    # Existing participant becoming payer gets automatic
                    # self-settlement.
                    # -------------------------------------------------

                    if key == new_payer_key:
                        existing_split.amount = split_data["amount"]
                        existing_split.settled_amount = split_data["amount"]

                        existing_split.save(
                            update_fields=[
                                "amount",
                                "settled_amount",
                            ]
                        )
                        continue

                    # -------------------------------------------------
                    # Normal unsettled participant
                    # -------------------------------------------------

                    if existing_split.settled_amount == 0:
                        existing_split.amount = split_data["amount"]
                        existing_split.save(
                            update_fields=["amount"]
                        )

                # -----------------------------------------------------
                # Remove participants that are no longer present.
                # Settled participants are already protected above.
                # -----------------------------------------------------

                for key, existing_split in existing_splits.items():

                    if key not in incoming_splits:
                        if existing_split.settled_amount == 0:
                            existing_split.delete()

            return instance

class IndividualTransactionSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(
        source="contact.name",
        read_only=True
    )

    settled_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True
    )

    remaining_amount = serializers.SerializerMethodField()

    class Meta:
        model = IndividualTransaction
        fields = [
            "id",
            "contact",
            "contact_name",
            "direction",
            "amount",
            "settled_amount",
            "remaining_amount",
            "note",
            "transaction_datetime",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "contact",
            "contact_name",
            "settled_amount",
            "remaining_amount",
            "created_at",
        ]

    def get_remaining_amount(self, obj):
        return obj.amount - obj.settled_amount

    def validate(self, data):
        user = self.context["request"].user
        contact = self.context.get("contact")
    
        if contact is None:
            raise serializers.ValidationError({
                "contact": "Contact is required."
            })
    
        if contact.owner != user:
            raise serializers.ValidationError({
                "contact": "You can only use your own contacts."
            })
    
        if data["amount"] <= 0:
            raise serializers.ValidationError({
                "amount": "Amount must be greater than zero."
            })
    
        return data