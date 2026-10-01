import api from "@/lib/api";


export async function settleSplit(splitId: number) {
    const response = await api.post(
        `/transaction-splits/${splitId}/settle/`
    );

    return response.data;
}

export async function getTransactions() {
    const response = await api.get("/transactions/");
    return response.data;
}

export async function getTransaction(id: number) {
    const response = await api.get(`/transactions/${id}/`);
    return response.data;
}

export async function createTransaction(data: {
    payer_user: number | null;
    payer_contact: number | null;
    total_amount: string;
    note: string;
    transaction_datetime: string;
    splits: {
        user: number | null;
        contact: number | null;
        amount: string;
    }[];
}) {
    const response = await api.post("/transactions/", data);
    return response.data;
}

export async function updateTransaction(
    id: number,
    data: {
        payer_user: number | null;
        payer_contact: number | null;
        total_amount: string;
        note: string;
        transaction_datetime: string;
        splits: {
            user: number | null;
            contact: number | null;
            amount: string;
        }[];
    }
) {
    const response = await api.patch(`/transactions/${id}/`, data);
    return response.data;
}

export async function deleteTransaction(id: number) {
    const response = await api.delete(`/transactions/${id}/`);
    return response.data;
}