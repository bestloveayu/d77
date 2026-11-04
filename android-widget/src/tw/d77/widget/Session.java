package tw.d77.widget;

import org.json.JSONObject;
import java.time.Instant;
import java.text.DateFormat;
import java.util.Date;

final class Session {
    static long expiry(JSONObject state) {
        String value = state.optString("expiresAt", "");
        try {
            if (value.matches("[0-9]{1,16}")) {
                long number = Long.parseLong(value);
                return number < 100000000000L ? number * 1000L : number;
            }
            return Instant.parse(value).toEpochMilli();
        } catch (Exception ignored) { return 0; }
    }
    static boolean expired(JSONObject state) {
        long end = expiry(state); return !state.optString("token").isEmpty() && (end <= 0 || end <= System.currentTimeMillis());
    }
    static String label(JSONObject state) {
        long end = expiry(state);
        return end == 0 ? "工作階段期限待伺服器確認" : "授權到期 · " + DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(new Date(end));
    }
}
