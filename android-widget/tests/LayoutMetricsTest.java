import tw.d77.widget.LayoutMetrics;

public final class LayoutMetricsTest {
    public static void main(String[] args) {
        check(110,0); check(160,2); check(210,1); check(300,3); check(400,4); check(650,8);
        if(LayoutMetrics.rows(190,1.5f)>=LayoutMetrics.rows(190,1f))throw new AssertionError("Font scaling must reduce row count");
        if(LayoutMetrics.height(180,500,false)!=500)throw new AssertionError("Portrait must use max height");
        if(LayoutMetrics.height(180,500,true)!=180)throw new AssertionError("Landscape must use min height");
        if(LayoutMetrics.width(280,500,false)!=280)throw new AssertionError("Portrait width");
    }
    private static void check(int height, int expected) {
        if (LayoutMetrics.rows(height) != expected) throw new AssertionError("Height " + height);
    }
}
