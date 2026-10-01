import api from "@/lib/api"

export async function getBalance(contactId: number) {
    const response = await api.get(`/contacts/${contactId}/balance/`);
    return response.data;
}