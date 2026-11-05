package tw.d77.widget;

import android.content.Context;
import android.content.SharedPreferences;

final class RefreshStatus {
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences("refresh-status",Context.MODE_PRIVATE);}
    static void mark(Context c,String phase){prefs(c).edit().putString("phase",phase).putLong("at",System.currentTimeMillis()).apply();}
    static void clear(Context c){prefs(c).edit().clear().apply();}
    static String message(Context c){
        SharedPreferences p=prefs(c);String phase=p.getString("phase","");long age=Math.max(0,System.currentTimeMillis()-p.getLong("at",0));
        if("queued".equals(phase))return age<120000?"已收到更新請求，等待系統執行…":"系統尚未執行更新，請再試或開啟 App";
        if("running".equals(phase))return age<120000?"正在讀取雲端資料…":"更新尚未完成，請稍後再試";
        if("schedule-error".equals(phase))return "系統未接受更新，請開啟 App 後再試";
        if("timeout".equals(phase))return "連線逾時，保留上次資料；可重新整理";
        if("network".equals(phase))return "無法連線，請檢查網路後重新整理";
        if("cloud".equals(phase))return "雲端更新未完成，保留上次資料";
        if("error".equals(phase))return "更新失敗，保留上次資料；可重新整理";
        if("success".equals(phase)&&age<120000)return "剛完成檢查 · "+java.time.Instant.ofEpochMilli(p.getLong("at",0)).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss"));
        return null;
    }
}
