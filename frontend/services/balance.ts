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