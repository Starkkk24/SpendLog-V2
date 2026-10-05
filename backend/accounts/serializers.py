from rest_framework import serializers
from .models import Contact, Transaction, TransactionSplit
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

        payer_user = data.get("payer_user")
        payer_contact = data.get("payer_contact")
        splits = data.get("splits")

        if splits is None and self.instance:
            splits = list(
                self.instance.splits.all().values(
                    "user",
                    "contact",
                    "amount"
                )
            )
        else:
            splits = splits or []
        
        total_amount = data.get(
            "total_amount",
            self.instance.total_amount if self.instance else None
        )

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
            split_user = split.get("user")
            split_contact = split.get("contact")

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
            split_total += split["amount"]

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
    
        with transaction.atomic():
        
            # Update transaction-level fields
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
    
            instance.save()
    
            if splits_data is not None:
            
                existing_splits = {
                    (
                        "user", split.user_id
                    ) if split.user_id else (
                        "contact", split.contact_id
                    ): split
                    for split in instance.splits.all()
                }
    
                incoming_keys = set()
    
                for split_data in splits_data:
                
                    split_user = split_data.get("user")
                    split_contact = split_data.get("contact")
    
                    key = (
                        ("user", split_user.id)
                        if split_user
                        else ("contact", split_contact.id)
                    )
    
                    incoming_keys.add(key)
    
                    existing_split = existing_splits.get(key)
    
                    # New participant
                    if existing_split is None:
                        TransactionSplit.objects.create(
                            transaction=instance,
                            settled_amount=0,
                            **split_data
                        )
                        continue
                    
                    # Existing split with settlement activity
                    if existing_split.settled_amount > 0:
                    
                        if split_data["amount"] != existing_split.amount:
                            raise serializers.ValidationError({
                                "splits": (
                                    f"Amount for an already-settled participant "
                                    f"cannot be changed."
                                )
                            })
    
                        # Keep existing settlement state.
                        continue
                    
                    # Existing split with no settlement activity
                    existing_split.amount = split_data["amount"]
                    existing_split.save(update_fields=["amount"])
    
                # Remove participants that are no longer present
                for key, existing_split in existing_splits.items():
                
                    if key not in incoming_keys:
                    
                        if existing_split.settled_amount > 0:
                            raise serializers.ValidationError({
                                "splits": (
                                    "A participant with settlement activity "
                                    "cannot be removed."
                                )
                            })
    
                        existing_split.delete()
    
        return instance