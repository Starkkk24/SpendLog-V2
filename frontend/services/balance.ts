import api from "@/lib/api"

export async function getBalance(
    contactId: number,
    settled: boolean
) {
    const response = await api.get(
        `/contacts/${contactId}/balance/?settled=${settled}`
    );

    return response.data;
}

export async function settleContactBalance(contactId: number) {
    const response = await api.post(
        `/contacts/${contactId}/settle-all/`
    );

    return response.data;
}

export async function getProfileBalance() {
    const response = await api.get(
        `/profile/balance/`
    );

    return response.data;
}

export type StatementStatus = "unsettled" | "settled" | "all";

export async function getStatement(
    contactId: number,
    params: { status: StatementStatus; from?: string; to?: string }
) {
    const response = await api.get(
        `/contacts/${contactId}/statement/`,
        { params }
    );

    return response.data;
}
