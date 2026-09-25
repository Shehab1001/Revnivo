from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, trim_whitespace=True)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=10, max_length=128, write_only=True)

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Name must contain at least 2 characters.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(max_length=128, write_only=True, trim_whitespace=False)


class PlatformSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    website = serializers.URLField(required=False, allow_blank=True)
    default_currency = serializers.CharField(max_length=8, default="USD")
    logo = serializers.ImageField(required=False, allow_null=True)
    status = serializers.ChoiceField(
        choices=["working", "applied", "not active", "under review"],
        default="not active",
    )
    display_order = serializers.IntegerField(required=False, min_value=0)

    def validate_default_currency(self, value):
        return value.strip().upper()


class EarningSerializer(serializers.Serializer):
    platform_id = serializers.CharField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0.01)
    currency = serializers.CharField(max_length=8)
    earned_at = serializers.DateField()
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)
    category = serializers.CharField(required=True, allow_blank=False, max_length=80)

    def validate_currency(self, value):
        return value.strip().upper()
