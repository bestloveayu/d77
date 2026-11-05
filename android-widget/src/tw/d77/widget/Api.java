package tw.d77.widget;

import org.json.JSONObject;
import java.io.*;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;

final class Api {
    static final class Unauthorized extends IOException { }
    static JSONObject request(String path, String token, JSONObject body) throws Exception {
        if (!path.equals("/widget/redeem") && !path.equals("/widget/data") && !path.equals("/widget/logout")) throw new IOException("Invalid endpoint");
        if (token != null && !token.matches("d77w_[0-9a-fA-F]{64}")) throw new IOException("Invalid credential");
        HttpsURLConnection c = (HttpsURLConnection) new URL("https://dong77-cloud-board-api.dong77-cloud-board.workers.dev" + path).openConnection();
        c.setInstanceFollowRedirects(false); c.setConnectTimeout(12000); c.setReadTimeout(path.equals("/widget/data")?90000:20000);
        c.setUseCaches(false); c.setRequestProperty("Accept", "application/json");
        if (token != null) c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestMethod(body == null ? "GET" : "POST");
        try {
            if (body != null) {
                c.setDoOutput(true); c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                byte[] bytes = body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
                c.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream o = c.getOutputStream()) { o.write(bytes); }
            }
            int status = c.getResponseCode();
            if (status == 401 || status == 403) throw new Unauthorized();
            if (status < 200 || status >= 300) throw new IOException("Request rejected");
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] b = new byte[4096]; int n;
                while ((n = in.read(b)) != -1) { if (out.size() + n > 262144) throw new IOException("Response too large"); out.write(b, 0, n); }
                String text = out.toString("UTF-8"); return text.isEmpty() ? new JSONObject() : new JSONObject(text);
            }
        } finally { c.disconnect(); }
    }
}
