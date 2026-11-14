import tw.d77.widget.Shortcut;
public final class ShortcutTest {
    static void eq(String a,String b){if(!a.equals(b))throw new AssertionError(a+" != "+b);}
    public static void main(String[] args){
        Shortcut s=Shortcut.resolve("rules-pending","id &/#?","ignored","overview","");
        eq(s.label,"");eq(s.action,"view");
        eq(Shortcut.url(s.page,s.filter,s.order,s.product,s.action),"https://bestloveayu.github.io/d77/?widgetFilter=rules&widgetOrder=id%20%26%2F%23%3F&widgetAction=view#orders");
        s=Shortcut.resolve("rules","not-an-order","遊戲 & 卡","overview","");
        eq(s.order,"");eq(s.action,"view");eq(s.label,"");eq(s.product,"遊戲 & 卡");
        eq(Shortcut.url(s.page,s.filter,s.order,s.product,s.action),"https://bestloveayu.github.io/d77/?widgetProduct=%E9%81%8A%E6%88%B2%20%26%20%E5%8D%A1&widgetAction=view#rules");
        for(String type:new String[]{"order","shortage"}){
            Shortcut target=Shortcut.resolve(type,"abc","A","overview","");
            eq(target.action,"view");eq(target.label,"");
        }
        eq(Shortcut.url("orders","rules","abc","","email"),"https://bestloveayu.github.io/d77/?widgetFilter=rules&widgetOrder=abc&widgetAction=email#orders");
        eq(Shortcut.url("rules","","","A","copy-rules"),"https://bestloveayu.github.io/d77/?widgetProduct=A&widgetAction=copy-rules#rules");
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

