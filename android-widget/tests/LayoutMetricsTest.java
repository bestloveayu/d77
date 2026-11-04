import tw.d77.widget.LayoutMetrics;

public final class LayoutMetricsTest {
    public static void main(String[] args) {
        check(110,1); check(140,2); check(190,4); check(269,4); check(270,4); check(400,6);
        if(LayoutMetrics.rows(190,1.5f)>=LayoutMetrics.rows(190,1f))throw new AssertionError("Font scaling must reduce row count");
    }
    private static void check(int height, int expected) {
        if (LayoutMetrics.rows(height) != expected) throw new AssertionError("Height " + height);
    }
}
