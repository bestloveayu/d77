import tw.d77.widget.Shortcut;
public final class ShortcutTest {
    static void eq(String a,String b){if(!a.equals(b))throw new AssertionError(a+" != "+b);}
    public static void main(String[] args){
        Shortcut s=Shortcut.resolve("rules-pending","id &/#?","ignored","overview","");
        eq(s.label,"編輯郵件");
        eq(Shortcut.url(s.page,s.filter,s.order,s.product,s.action),"https://bestloveayu.github.io/d77/?widgetFilter=rules&widgetOrder=id%20%26%2F%23%3F&widgetAction=email#orders");
        s=Shortcut.resolve("rules","not-an-order","遊戲 & 卡","overview","");
        eq(s.order,"");eq(s.action,"copy-rules");eq(s.product,"遊戲 & 卡");
        eq(Shortcut.resolve("order","abc","","overview","").order,"abc");
        eq(Shortcut.resolve("shortage","wrong-id","A","overview","").order,"");
        eq(Shortcut.resolve("stock","transaction-id","A","inventory","").label,"");
        eq(Shortcut.resolve("rules-pending","","","orders","").label,"");
        eq(Shortcut.resolve("order","bad\nvalue","","orders","").label,"");
        eq(Shortcut.url("https://evil.test","bad","abc","A","email"),"https://bestloveayu.github.io/d77/#overview");
        eq(Shortcut.url("rules","shortage","abc","A#&","email"),"https://bestloveayu.github.io/d77/?widgetProduct=A%23%26&widgetAction=view#rules");
        eq(Shortcut.url("orders","pending",null,null,null),"https://bestloveayu.github.io/d77/?widgetFilter=pending#orders");
        System.out.println("ShortcutTest passed: routing, encoding, identity boundaries, legacy fallback");
    }
}

