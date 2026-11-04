package tw.d77.widget;

import android.app.job.*;
import android.content.*;
import android.os.SystemClock;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class Sync {
    static final ExecutorService WORK = Executors.newSingleThreadExecutor();
    static final int JOB = 7702;
    private static long lastManual = -60000;
    static synchronized boolean allowManual() {
        long now = SystemClock.elapsedRealtime();
        if (now - lastManual < 30000) return false;
        lastManual = now; return true;
    }
    static void schedule(Context c) {
        if (new Vault(c).read().optString("token").isEmpty()) return;
        c.getSystemService(JobScheduler.class).schedule(new JobInfo.Builder(JOB, new ComponentName(c, RefreshJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(30 * 60 * 1000L).build());
    }
    static void requestRefresh(Context c) {
        if(new Vault(c).read().optString("token").isEmpty())return;
        c.getSystemService(JobScheduler.class).schedule(new JobInfo.Builder(JOB+1,new ComponentName(c,RefreshJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).build());
    }
    static void clear(Context c) { new Vault(c).clear(); c.getSystemService(JobScheduler.class).cancel(JOB); c.getSystemService(JobScheduler.class).cancel(JOB+1); }
    static boolean validCount(Object n) { return n instanceof Number && ((Number)n).doubleValue()>=0 && ((Number)n).doubleValue()<=1000000 && ((Number)n).doubleValue()==((Number)n).longValue(); }
    static void refresh(Context c) {
        Vault v = new Vault(c); JSONObject s = v.read(); String token = s.optString("token");
        if (Session.expired(s)) { clear(c); BoardWidget.renderAll(c); return; }
        if (token.isEmpty()) { BoardWidget.renderAll(c); return; }
        try {
            JSONObject data = Api.request("/widget/data", token, null);
            if (!(data.opt("counts") instanceof JSONObject)) throw new java.io.IOException("Invalid data");
            JSONObject counts=data.getJSONObject("counts");boolean available=false;
            for(String key:new String[]{"awaitingPurchase","awaitingShipment","awaitingRules","shortage"}){
                if(!counts.has(key))throw new java.io.IOException("Missing count");
                if(!counts.isNull(key)){if(!validCount(counts.opt(key)))throw new java.io.IOException("Invalid count");available=true;}
            }
            if(!available&&s.optJSONObject("data")!=null){s.put("failed",true);}
            else {s.put("data", data);s.put("failed", false);}
            v.write(s);
        } catch (Api.Unauthorized e) { clear(c); }
        catch (Exception e) { try { s.put("failed", true); v.write(s); } catch (Exception ignored) { } }
        BoardWidget.renderAll(c);
    }
}
