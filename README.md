# SpendLog 💸

SpendLog is a personal expense and money-splitting web application built to record transactions and keep track of **who paid, who participated, and how much each person owes**.

The goal is simple: instead of maintaining expenses in a diary or manually calculating who owes whom, SpendLog keeps the transaction history and its splits connected.

---

## What SpendLog Does

### Authentication

- User signup
- User login
- JWT access and refresh tokens
- Logout with refresh-token blacklisting
- Protected API endpoints

### Contacts

Users can maintain their own list of people they frequently transact with.

- Create contact
- View all contacts
- View a single contact
- Update contact
- Delete contact
- Contacts are isolated per authenticated user

### Transactions

A transaction records an actual money exchange.

Each transaction contains:

- Total amount
- Note
- Date and time
- Who paid
- Participants and their individual shares

Users can create transactions where either:

- **The logged-in user paid**, or
- **One of their contacts paid**

Transactions can then be viewed individually.

### Transaction Splits

Every transaction can contain multiple participants.

For each participant, SpendLog stores:

- User or contact
- Individual share amount

The backend validates that:

- Every split has exactly one participant
- A participant cannot appear twice
- Contacts belong to the current user
- The logged-in user can only be selected as the user participant
- The sum of all shares equals the transaction total

This provides the foundation for the future **Balance Engine**.

---

# Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend | Django |
| API | Django REST Framework |
| Authentication | JWT / SimpleJWT |
| HTTP Client | Axios |
| Database | Django-supported relational database |
| Runtime | Python + Node.js |

---

# Architecture

SpendLog follows a client-server architecture:

```text
┌──────────────────────────────┐
│          Frontend            │
│          Next.js             │
│                              │
│  Pages / Components          │
│          ↓                   │
│  Service Layer               │
│  auth.ts                     │
│  contacts.ts                 │
│  transactions.ts             │
└──────────────┬───────────────┘
               │
               │ HTTP / Axios
               │ JWT
               ▼
┌──────────────────────────────┐
│           Backend            │
│       Django + DRF           │
│                              │
│  URLs                        │
│    ↓                         │
│  Views                       │
│    ↓                         │
│  Serializers                 │
│    ↓                         │
│  Models                      │
│    ↓                         │
│  Database                    │
└──────────────────────────────┘
```

---

# Project Structure

```text
SpendLog-V2/
│
├── backend/
│   ├── accounts/
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── ...
│   │
│   ├── manage.py
│   ├── db.sqlite3
│   └── ...
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   │
│   │   ├── (main)/
│   │   │   └── dashboard/
│   │   │
│   │   ├── contacts/
│   │   │   ├── page.tsx
│   │   │   └── ...
│   │   │
│   │   └── transactions/
│   │       ├── page.tsx
│   │       ├── new/
│   │       └── [id]/
│   │
│   ├── services/
│   │   ├── auth.ts
│   │   ├── contacts.ts
│   │   └── transactions.ts
│   │
│   ├── lib/
│   │   └── api.ts
│   │
│   ├── package.json
│   └── ...
│
└── README.md
```

---

# Authentication Flow

```text
Signup
  ↓
User created
  ↓
Login
  ↓
Username + Password
  ↓
Django authenticate()
  ↓
JWT Access + Refresh tokens
  ↓
Frontend stores tokens
  ↓
Access token sent with API requests
  ↓
Protected endpoint
  ↓
IsAuthenticated
  ↓
request.user
```

Logout works by taking the refresh token and blacklisting it.

---

# Contacts Flow

Contacts are owned by the authenticated user.

```text
Frontend
   ↓
contacts.ts
   ↓
Axios
   ↓
GET /contacts/
   ↓
contact_list()
   ↓
Contact.objects.filter(owner=request.user)
   ↓
ContactSerializer
   ↓
JSON response
   ↓
Frontend
```

For creation:

```text
Frontend
   ↓
POST /contacts/
   ↓
contact_list()
   ↓
ContactSerializer
   ↓
serializer.save(owner=request.user)
   ↓
Database
```

For an individual contact:

```text
GET    /contacts/<id>/
PATCH  /contacts/<id>/
DELETE /contacts/<id>/
```

The backend uses:

```python
get_object_or_404(
    Contact,
    id=pk,
    owner=request.user
)
```

This ensures users can only access their own contacts.

---

# Transactions Flow

Transactions follow the same basic API architecture.

```text
Frontend transaction form
          ↓
createTransaction()
          ↓
Axios POST
          ↓
/transactions/
          ↓
transaction_list()
          ↓
TransactionSerializer
          ↓
validate()
          ↓
create()
          ↓
Transaction
          +
TransactionSplit objects
          ↓
Database
```

## Transaction Structure

A transaction contains the overall information:

```text
Transaction
│
├── id
├── payer_user
├── payer_contact
├── total_amount
├── note
├── transaction_datetime
└── created_at
```

Its participants are represented separately through `TransactionSplit`:

```text
Transaction
│
├── Split → User / Contact → ₹150
├── Split → Contact → ₹150
└── Split → Contact → ₹150
```

---

# TransactionSerializer

`TransactionSerializer` translates between the `Transaction` model and API JSON.

It exposes:

```text
id
payer_user
payer_user_name
payer_contact
payer_contact_name
total_amount
note
transaction_datetime
splits
created_at
```

The additional name fields are generated using `SerializerMethodField`.

For example:

```python
def get_payer_contact_name(self, obj):
    return obj.payer_contact.name if obj.payer_contact else None
```

This means the frontend doesn't need another request simply to display the payer's name.

---

# Transaction Validation

Before a transaction is created, the serializer validates the data.

### 1. Exactly One Payer

```text
payer_user XOR payer_contact
```

Both cannot be provided.

Neither can be provided.

Exactly one must exist.

### 2. User Payer Authorization

If the payer is a user, it must be the currently authenticated user.

### 3. Contact Ownership

If a contact is selected as payer:

```text
payer_contact.owner == request.user
```

must be true.

### 4. Split Validation

Each split must contain exactly one:

```text
user
OR
contact
```

### 5. Participant Authorization

A user participant can only be:

```text
request.user
```

A contact participant must belong to:

```text
request.user
```

### 6. No Duplicate Participants

A set is used to create unique participant keys:

```text
user:1
contact:4
contact:7
```

If the same participant appears again, validation fails.

### 7. Split Total Validation

```text
Split 1
+ Split 2
+ Split 3
----------------
= Transaction total
```

Example:

```text
Transaction = ₹450

Stark       ₹150
Meghnaa     ₹150
Aishwarya   ₹150
----------------
            ₹450 ✓
```

If the numbers don't match, the transaction is rejected.

---

# Atomic Transaction Creation

The transaction and its splits are created inside:

```python
with transaction.atomic():
```

This means the database treats the operation as one unit.

```text
Create Transaction
       ↓
Create Splits
       ↓
Everything succeeds
       ↓
COMMIT
```

If something fails:

```text
Create Transaction
       ↓
Create Splits
       ↓
Something fails
       ↓
ROLLBACK
```

This prevents a transaction from being saved without its splits.

---

# TransactionSplitSerializer

`TransactionSplitSerializer` represents an individual participant's share.

It exposes:

```text
user
user_name
contact
contact_name
amount
```

The name fields are generated from the related objects.

Example response:

```json
{
    "user": null,
    "user_name": null,
    "contact": 5,
    "contact_name": "Meghnaa",
    "amount": "150.00"
}
```

---

# Transaction API Views

## `transaction_list`

Handles:

```text
GET  /transactions/
POST /transactions/
```

### GET

Only transactions relevant to the current user are returned.

The query checks:

```python
Q(payer_user=request.user) |
Q(payer_contact__owner=request.user)
```

Then:

```python
.prefetch_related("splits")
```

is used to efficiently load the transaction's splits.

### POST

The request is passed into:

```python
TransactionSerializer(
    data=request.data,
    context={"request": request}
)
```

The context is important because the serializer needs:

```python
request.user
```

for authorization and validation.

---

# `transaction_detail`

Handles an individual transaction:

```text
GET    /transactions/<id>/
PATCH  /transactions/<id>/
DELETE /transactions/<id>/
```

The transaction is first restricted to transactions accessible by the current user.

This prevents users from modifying or deleting someone else's transaction.

---

# Frontend Transaction Architecture

The frontend separates API communication from page components.

For example:

```text
frontend/services/transactions.ts
```

contains:

```typescript
getTransactions()
getTransaction(id)
createTransaction(data)
```

The page doesn't directly construct Axios requests everywhere.

Instead:

```text
Page
 ↓
Service function
 ↓
Axios instance
 ↓
Backend API
```

This keeps the frontend cleaner and makes the API layer reusable.

---

# Transaction Pages

## Transaction List

```text
/transactions
```

Shows:

- Recorded transactions
- Note
- Date/time
- Total amount
- Number of participants
- New Transaction button

## Create Transaction

```text
/transactions/new
```

The form is organized into:

```text
1. Who paid?
        ↓
2. Transaction details
        ↓
3. Split between
        ↓
4. Split summary
        ↓
Create transaction
```

The frontend calculates:

```text
Transaction Total
        -
Assigned Amount
        =
Remaining
```

The Create button is enabled only when:

```text
Assigned Amount === Transaction Total
```

## Transaction Detail

```text
/transactions/[id]
```

Displays:

- Transaction note
- Date/time
- Total amount
- Participants
- Individual shares
- Back to transactions

---

# Current Implementation Status

```text
PHASE 1 — Authentication
├── Signup              ✅
├── Login               ✅
├── JWT                 ✅
├── Refresh             ✅
├── Logout              ✅
└── Protected API       ✅

PHASE 2 — Contacts
├── Create Contact      ✅
├── List Contacts       ✅
├── Get Contact         ✅
├── Update Contact      ✅
└── Delete Contact      ✅

PHASE 3 — Transactions
├── Create Expense      ✅
├── List Expenses       ✅
├── Get Expense         ✅
├── Update Expense      ✅
└── Delete Expense      ✅

PHASE 4 — Transaction Splits
├── Add participants    ✅
├── Assign shares       ✅
├── Validate shares     ✅
└── Link splits ↔ transaction ✅

PHASE 5 — Balance Engine
├── Who owes whom?      ⬜
├── Amount owed         ⬜
├── Amount receivable   ⬜
└── Running balances    ⬜

PHASE 6 — Dashboard
├── Total spent         ⬜
├── Money owed to you   ⬜
├── Money you owe       ⬜
├── Recent transactions ⬜
└── Contact balances    ⬜

PHASE 7 — Frontend UX
├── Forms               🔄
├── Loading states      🔄
├── Error handling      🔄
├── Empty states        🔄
├── Modals              ⬜
└── Responsive UI       🔄

PHASE 8 — Hardening
├── API error architecture   ⬜
├── Authorization/security   ⬜
├── Validation               🔄
├── Edge cases               ⬜
└── Testing                  ⬜
```

---

# The Big Picture

The current core of SpendLog is:

```text
                 USER
                  │
                  ▼
            AUTHENTICATION
                  │
                  ▼
              CONTACTS
                  │
                  ▼
            TRANSACTION
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
      PAYER              SPLITS
                            │
                 ┌──────────┼──────────┐
                 ▼          ▼          ▼
               User      Contact    Contact
                 │          │          │
                 └──────────┴──────────┘
                            │
                            ▼
                    BALANCE ENGINE
                            │
                            ▼
                       DASHBOARD
```

The key architectural distinction is:

> **A `Transaction` represents the money event, while `TransactionSplit` represents how that transaction is distributed among people.**

This distinction is what makes the upcoming **Balance Engine** possible without redesigning the entire system.
