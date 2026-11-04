package tw.d77.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.widget.*;
import org.json.JSONObject;

public final class SetupActivity extends Activity {
    private int widgetId;
    private TextView status;
    private EditText code;
    private Button pair, logout;
    private boolean busy;
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        setResult(RESULT_CANCELED);
        boolean dark = (getResources().getConfiguration().uiMode & 48) == 32;
        LinearLayout content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL);
        int pad = (int)(24 * getResources().getDisplayMetrics().density);
        content.setPadding(pad,pad,pad,pad); content.setBackgroundColor(Color.parseColor(dark ? "#142C23" : "#F5F7EF"));
        content.setOnApplyWindowInsetsListener((view, insets) -> { view.setPadding(pad, pad + insets.getSystemWindowInsetTop(), pad, pad + insets.getSystemWindowInsetBottom()); return insets; });
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.addView(content); setContentView(scroll);
        TextView title = new TextView(this); title.setText("東77 桌面小工具"); title.setTextSize(26); title.setTypeface(android.graphics.Typeface.SERIF); content.addView(title);
        status = new TextView(this); content.addView(status);
        Button website = new Button(this); website.setText("開啟雲端管理・取得配對碼"); content.addView(website);
        website.setOnClickListener(view -> startActivity(new Intent(this, OpenActivity.class).putExtra("page", "overview")));
        code = new EditText(this); code.setSingleLine(true); code.setHint("一次性配對碼 (32 位 hex)");
        code.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        code.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        code.setSaveEnabled(false); content.addView(code);
        pair = new Button(this); pair.setText("配對"); pair.setMinHeight((int)(48 * getResources().getDisplayMetrics().density)); content.addView(pair);
        TextView themeLabel = new TextView(this); themeLabel.setText("此小工具外觀"); content.addView(themeLabel);
        RadioGroup themes = new RadioGroup(this); content.addView(themes);
        String[] modes = {"system","day","night"}, labels = {"跟隨系統","日間","夜間"};
        Vault vault = new Vault(this);
        for (int n = 0; n < 3; n++) {
            RadioButton radio = new RadioButton(this); radio.setId(1000+n); radio.setText(labels[n]); themes.addView(radio);
            if (modes[n].equals(vault.theme(widgetId))) radio.setChecked(true);
        }
        themes.setEnabled(widgetId != AppWidgetManager.INVALID_APPWIDGET_ID);
        for (int n = 0; n < themes.getChildCount(); n++) themes.getChildAt(n).setEnabled(widgetId != AppWidgetManager.INVALID_APPWIDGET_ID);
        themes.setOnCheckedChangeListener((group,id) -> { if (id >= 1000 && id <= 1002) { new Vault(this).theme(widgetId,modes[id-1000]); BoardWidget.renderAll(this); } });
        logout = new Button(this); logout.setText("解除所有小工具配對"); content.addView(logout);
        Button done = new Button(this); done.setText("完成"); content.addView(done);
        done.setOnClickListener(view -> { if (busy) return; Sync.schedule(this); BoardWidget.renderAll(this); setResult(RESULT_OK,new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,widgetId)); finish(); });
        pair.setOnClickListener(view -> redeem());
        logout.setOnClickListener(view -> disconnect());
        int fg = Color.parseColor(dark ? "#F0F3E9" : "#183E2C");
        title.setTextColor(fg); status.setTextColor(fg); themeLabel.setTextColor(fg); code.setTextColor(fg);
        code.setHintTextColor(Color.parseColor(dark ? "#B7CABB" : "#526A59"));
        for (int n = 0; n < themes.getChildCount(); n++) ((RadioButton)themes.getChildAt(n)).setTextColor(fg);
        showState();
    }
    private void showState() {
        JSONObject state = new Vault(this).read();
        if (Session.expired(state)) { Sync.clear(this); BoardWidget.renderAll(this); state = new JSONObject(); }
        status.setText(state.optString("token").isEmpty() ? "尚未配對 · 配對碼有效期限 5 分鐘" : "已配對 · 不顯示帳戶個資\n" + Session.label(state));
    }
    private void busy(boolean value) { busy = value; pair.setEnabled(!value); logout.setEnabled(!value); code.setEnabled(!value); }
    private void redeem() {
        String input = code.getText().toString().trim().toLowerCase(java.util.Locale.ROOT);
        if (!input.matches("[0-9a-fA-F]{32}")) { status.setText("請輸入 32 位十六進位配對碼"); return; }
        busy(true); code.setText(""); status.setText("配對中…");
        final android.content.Context app = getApplicationContext();
        Sync.WORK.execute(() -> {
            boolean ok = false;
            try {
                JSONObject result = Api.request("/widget/redeem",null,new JSONObject().put("code",input));
                if (!result.optString("token").matches("d77w_[0-9a-fA-F]{64}") || !result.has("expiresAt")) throw new java.io.IOException("Invalid response");
                JSONObject state = new JSONObject().put("token",result.getString("token")).put("expiresAt",result.get("expiresAt"));
                new Vault(app).write(state); Sync.schedule(app); Sync.refresh(app); ok = !new Vault(app).read().optString("token").isEmpty();
            } catch (Exception ignored) { }
            final boolean success = ok;
            runOnUiThread(() -> { if (isDestroyed()) return; busy(false); if (success) showState(); else status.setText("配對失敗，請確認網路並取得新配對碼"); });
        });
    }
    private void disconnect() {
        busy(true); status.setText("解除中…");
        final android.content.Context app = getApplicationContext();
        Sync.WORK.execute(() -> {
            String token = new Vault(app).read().optString("token");
            Sync.clear(app); BoardWidget.renderAll(app);
            boolean remote = true;
            if (!token.isEmpty()) try { Api.request("/widget/logout",token,new JSONObject()); } catch (Exception ignored) { remote = false; }
            final boolean revoked = remote;
            runOnUiThread(() -> { if (isDestroyed()) return; busy(false); status.setText(revoked ? "已解除配對" : "本機已清除；遠端撤銷失敗，請在網站撤銷裝置"); });
        });
    }
}
