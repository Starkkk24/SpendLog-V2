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

export async function getProfileBalance() {
    const response = await api.get(
        `/profile/balance/`
    );

    return response.data;
}