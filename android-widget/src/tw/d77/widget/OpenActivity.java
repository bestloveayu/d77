package tw.d77.widget;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;

public final class OpenActivity extends Activity {
    static String page(String p) { return "orders".equals(p) || "inventory".equals(p) || "rules".equals(p) ? p : "overview"; }
    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        String page=page(getIntent().getStringExtra("page")),filter=getIntent().getStringExtra("filter");
        boolean valid="orders".equals(page)&&("pending".equals(filter)||"registration".equals(filter)||"rules".equals(filter))||"inventory".equals(page)&&"shortage".equals(filter);
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://bestloveayu.github.io/d77/"+(valid?"?widgetFilter="+filter:"")+"#" + page)).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (android.content.ActivityNotFoundException ignored) { }
        finish();
    }
}
