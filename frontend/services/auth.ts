import api from "@/lib/api";

export async function login(username: string, password: string){
    const response = await api.post("/login/", {
        username, password,
    });

    localStorage.setItem("access", response.data.access);
    localStorage.setItem("refresh", response.data.refresh);

    return response.data;
}

export async function logout(){
    const refresh = localStorage.getItem("refresh");

    try {
        if (refresh) {
            await api.post("/logout/", {
                refresh,
            });
        }
    } catch (error) {
        console.error(error);
    } finally {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
    }
}

export async function getProtectedData(){
    const response = await api.get('/protected/');
    return response.data;
}


export async function signup(username: string, password: string){
   const response = await api.post("/signup/", {username, password});
   return response.data;
}