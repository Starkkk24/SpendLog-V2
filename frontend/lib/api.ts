export async function fetchWithAuth(url: string, options: any = {}) {
  let access = localStorage.getItem("access");

  let res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${access}`,
    },
  });

  // 🔥 If access expired
  if (res.status === 401) {
    const refresh = localStorage.getItem("refresh");

    const refreshRes = await fetch("http://127.0.0.1:8000/refresh/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();

      // save new access token
      localStorage.setItem("access", data.access);

      // retry original request
      res = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${data.access}`,
        },
      });
    } else {
      // refresh failed → logout
      localStorage.clear();
      window.location.href = "/login";
    }
  }

  return res;
}