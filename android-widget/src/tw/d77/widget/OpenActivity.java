package tw.d77.widget;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;

public final class OpenActivity extends Activity {
    static String page(String p) { return Shortcut.page(p); }
    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        String page=page(getIntent().getStringExtra("page")),filter=getIntent().getStringExtra("filter");
        Intent source=getIntent();
        String url=Shortcut.url(page,filter,source.getStringExtra("order"),source.getStringExtra("product"),source.getStringExtra("action"));
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (android.content.ActivityNotFoundException ignored) { }
        finish();
    }
}

