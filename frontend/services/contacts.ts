import api from "@/lib/api";

export async function getContacts() {
    const response = await api.get("/contacts/");
    return response.data;
}

export async function getContact(id: number) {
    const response = await api.get(`/contacts/${id}/`);
    return response.data;
}

export async function createContact(name: string) {
    const response = await api.post("/contacts/", {
        name,
    });
    return response.data;
}

export async function updateContact(id: number, name: string) {
    const response = await api.patch(`/contacts/${id}/`, {
        name,
    });
    return response.data;
}

export async function deleteContact(id: number) {
    const response = await api.delete(`/contacts/${id}/`);
    return response.data;
}