package tw.d77.widget;

public final class LayoutMetrics {
    private LayoutMetrics() { }
    public static int rows(int heightDp) { return rows(heightDp,1f); }
    public static int rows(int heightDp,float fontScale) {
        int rowHeight=(int)Math.ceil((heightDp>=320?62:heightDp>=210?54:30)*Math.max(1f,fontScale));
        int fixed=(int)Math.ceil((heightDp>=320?126:heightDp>=210?116:98)*Math.max(1f,fontScale));
        return Math.max(0,Math.min(8,(heightDp-fixed)/rowHeight));
    }
    public static int height(int minimum,int maximum,boolean landscape){return Math.max(110,landscape?minimum:Math.max(minimum,maximum));}
    public static int width(int minimum,int maximum,boolean landscape){return Math.max(250,landscape?Math.max(minimum,maximum):minimum);}
}
