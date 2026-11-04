package tw.d77.widget;

public final class LayoutMetrics {
    private LayoutMetrics() { }
    public static int rows(int heightDp) { return rows(heightDp,1f); }
    public static int rows(int heightDp,float fontScale) {
        int rowHeight=(int)Math.ceil((heightDp>=230?42:26)*Math.max(1f,fontScale));
        int fixed=(int)Math.ceil(84*Math.max(1f,fontScale));
        return Math.max(0,Math.min(6,(heightDp-fixed)/rowHeight));
    }
}
