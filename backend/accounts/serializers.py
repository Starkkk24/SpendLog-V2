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

    class Meta:
        model = TransactionSplit
        fields = [
            "id",
            "user",
            "user_name",
            "contact",
            "contact_name",
            "amount",
            "settled",
        ]

    def get_user_name(self, obj):
        return obj.user.username if obj.user else None

    def get_contact_name(self, obj):
        return obj.contact.name if obj.contact else None


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
        return obj.splits.filter(
            settled=False
        ).aggregate(
            total=Sum("amount")
        )["total"] or 0

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

        with transaction.atomic():
            transaction_obj = Transaction.objects.create(
                **validated_data
            )

            TransactionSplit.objects.bulk_create([
                TransactionSplit(
                    transaction=transaction_obj,
                    **split_data
                )
                for split_data in splits_data
            ])

        return transaction_obj

    def update(self, instance, validated_data):
        splits_data = validated_data.pop("splits", None)

        with transaction.atomic():

            # Update transaction fields
            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            instance.save()

            # If splits were supplied, replace the existing splits
            if splits_data is not None:
                instance.splits.all().delete()

                TransactionSplit.objects.bulk_create([
                    TransactionSplit(
                        transaction=instance,
                        **split_data
                    )
                    for split_data in splits_data
                ])

        return instance