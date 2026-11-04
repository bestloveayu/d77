package tw.d77.widget;

import android.app.Application;
import android.content.res.Configuration;

public final class WidgetApplication extends Application {
    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        BoardWidget.renderAll(this);
    }
}
