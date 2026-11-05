package tw.d77.widget;

import android.app.PendingIntent;
import android.appwidget.*;
import android.content.*;
import android.content.res.Configuration;
import android.os.Bundle;
import android.graphics.Color;
import android.widget.RemoteViews;
import org.json.*;

public final class BoardWidget extends AppWidgetProvider {
    static final String REFRESH = "tw.d77.widget.REFRESH";
    @Override public void onReceive(Context c, Intent i) {
        super.onReceive(c, i);
        if (REFRESH.equals(i.getAction()) && Sync.allowManual()) {
            Sync.requestRefresh(c);
        } else if (Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) { Sync.schedule(c); renderAll(c); }
    }
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { renderAll(c); Sync.schedule(c); }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { render(c, m, id); }
    @Override public void onDeleted(Context c, int[] ids) { for (int id : ids) new Vault(c).remove(id); }
    @Override public void onDisabled(Context c) { c.getSystemService(android.app.job.JobScheduler.class).cancel(Sync.JOB); }
    static void renderAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : m.getAppWidgetIds(new ComponentName(c, BoardWidget.class))) render(c, m, id);
    }
    private static PendingIntent open(Context c, String page) {
        return open(c,page,"");
    }
    private static PendingIntent open(Context c, String page, String filter) {
        Intent i = new Intent(c, OpenActivity.class).putExtra("page", OpenActivity.page(page)).putExtra("filter",filter);
        return PendingIntent.getActivity(c, 100 + (OpenActivity.page(page)+":"+filter).hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void render(Context c, AppWidgetManager m, int id) {
        Vault v = new Vault(c); JSONObject state = v.read(), data = state.optJSONObject("data");
        if (Session.expired(state)) { Sync.clear(c); state = new JSONObject(); data = null; }
        boolean login = state.optString("token").isEmpty();
        String mode = v.theme(id);
        boolean dark = "night".equals(mode) || ("system".equals(mode) && (c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
        int fg = Color.parseColor(dark ? "#F0F3E9" : "#183E2C"), muted = Color.parseColor(dark ? "#B7CABB" : "#526A59");
        RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.widget_board);
        r.setInt(R.id.root, "setBackgroundResource", dark ? R.drawable.widget_background_dark : R.drawable.widget_background);
        Bundle options=m.getAppWidgetOptions(id);
        boolean landscape=c.getResources().getConfiguration().orientation==Configuration.ORIENTATION_LANDSCAPE;
        int height=LayoutMetrics.height(options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,110),options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,110),landscape);
        boolean large=height>=320, medium=height>=210;
        int line=Color.parseColor(dark?"#436456":"#D2DDD7");
        for(int view:new int[]{R.id.header_line,R.id.metrics_line,R.id.footer_line,R.id.metric_sep1,R.id.metric_sep2,R.id.metric_sep3})r.setInt(view,"setBackgroundColor",line);
        for (int view : new int[]{R.id.heading,R.id.season,R.id.view_all}) r.setTextColor(view, fg);
        r.setImageViewResource(R.id.settings,dark?R.drawable.ic_settings_dark:R.drawable.ic_settings);
        r.setImageViewResource(R.id.refresh,dark?R.drawable.ic_refresh_dark:R.drawable.ic_refresh);
        r.setInt(R.id.refresh,"setBackgroundResource",dark?R.drawable.icon_button_dark:R.drawable.icon_button);
        r.setTextViewTextSize(R.id.heading,android.util.TypedValue.COMPLEX_UNIT_SP,26);
        r.setTextViewTextSize(R.id.season,android.util.TypedValue.COMPLEX_UNIT_SP,15);
        r.setTextColor(R.id.status, muted);
        r.setTextViewText(R.id.heading, "東77");
        r.setTextViewText(R.id.season,data==null?"":clean(data.optString("season"),24));
        boolean stale = state.optBoolean("failed") || (data != null && (data.optBoolean("stale") || (!data.isNull("error") && !data.optString("error").isEmpty())));
        r.setTextViewText(R.id.status, login ? "請先配對" : data == null ? "等待同步" : (stale ? "更新未完成 · " : "更新於 ") + formattedTime(data.optString("updatedAt")));
        r.setTextColor(R.id.status_dot,stale?Color.parseColor("#C79539"):fg);
        PendingIntent setup = PendingIntent.getActivity(c, id, new Intent(c, SetupActivity.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        r.setOnClickPendingIntent(R.id.settings, setup);
        r.setOnClickPendingIntent(R.id.heading, login ? setup : open(c,"overview"));
        r.setOnClickPendingIntent(R.id.view_all,login?setup:open(c,"overview"));
        r.setOnClickPendingIntent(R.id.refresh, login ? setup : PendingIntent.getBroadcast(c, 7, new Intent(c, BoardWidget.class).setAction(REFRESH), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        Intent feed=new Intent(c,FeedService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id);
        feed.setData(android.net.Uri.parse("d77-widget://feed/"+id+"/"+(dark?"night":"day")));
        r.setRemoteAdapter(R.id.feed,feed);
        Intent target=new Intent(c,OpenActivity.class);
        r.setPendingIntentTemplate(R.id.feed,PendingIntent.getActivity(c,770000+id,target,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_MUTABLE));
        String[] keys = {"awaitingPurchase","awaitingShipment","awaitingRules","shortage"};
        String[] labels = {"待下單","待出貨","待寄規則","缺貨"};
        int[] views = {R.id.purchase,R.id.shipment,R.id.rules,R.id.shortage};
        int[] values={R.id.purchase_value,R.id.shipment_value,R.id.rules_value,R.id.shortage_value};
        int[] labelViews={R.id.purchase_label,R.id.shipment_label,R.id.rules_label,R.id.shortage_label};
        JSONObject counts = data == null ? null : data.optJSONObject("counts");
        for (int n = 0; n < 4; n++) {
            Object raw = counts == null ? null : counts.opt(keys[n]);
            String value = Sync.validCount(raw) ? String.valueOf(((Number)raw).longValue()) : "—";
            r.setTextViewText(values[n],value);
            r.setTextColor(values[n],n==3&&Sync.validCount(raw)&&((Number)raw).longValue()>0?Color.parseColor("#C79539"):fg);
            r.setTextColor(labelViews[n],muted);
            r.setTextViewText(labelViews[n],n==2?"待寄":labels[n]);
            r.setTextViewTextSize(values[n],android.util.TypedValue.COMPLEX_UNIT_SP,large?18:16);
            r.setTextViewTextSize(labelViews[n],android.util.TypedValue.COMPLEX_UNIT_SP,large?11:10);
            r.setContentDescription(views[n],labels[n]+value);
            r.setOnClickPendingIntent(views[n],login ? setup : open(c,n == 3 ? "inventory" : "orders",new String[]{"pending","registration","rules","shortage"}[n]));
        }
        m.updateAppWidget(id,r);
        m.notifyAppWidgetViewDataChanged(id,R.id.feed);
    }
    private static String clean(String s, int max) { s = s.replaceAll("[\\p{Cntrl}]", " "); return s.substring(0,Math.min(s.length(),max)); }
    private static String formattedTime(String value) {
        try { return java.time.Instant.parse(value).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("MM/dd HH:mm")); }
        catch (Exception e) { return "時間待確認"; }
    }
    private static String shortTime(String value){try{return java.time.Instant.parse(value).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"));}catch(Exception e){return "";}}
}
