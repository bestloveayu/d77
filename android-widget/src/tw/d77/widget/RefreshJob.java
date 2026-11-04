package tw.d77.widget;

import android.app.job.JobParameters;
import android.app.job.JobService;

public final class RefreshJob extends JobService {
    private volatile boolean stopped;
    @Override public boolean onStartJob(final JobParameters p) {
        stopped = false;
        Sync.WORK.execute(() -> { Sync.refresh(getApplicationContext()); if (!stopped) jobFinished(p, false); });
        return true;
    }
    @Override public boolean onStopJob(JobParameters p) { stopped = true; return true; }
}
