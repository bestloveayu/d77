package tw.d77.widget;
import java.net.URLEncoder;

/** Navigation only, using structured identities rather than display text. */
public final class Shortcut {
    public final String page,filter,order,product,action,label;
    private Shortcut(String p,String f,String o,String n,String a,String l){page=p;filter=f;order=o;product=n;action=a;label=l;}
    public static String page(String p){return "orders".equals(p)||"rules".equals(p)||"inventory".equals(p)?p:"overview";}
    private static String identity(String s){return s!=null&&s.length()<=512&&!s.matches("(?s).*[\\p{Cntrl}].*")?s:"";}
    public static Shortcut resolve(String type,String id,String name,String fallback,String filter){
        id=identity(id);name=identity(name);
        if("rules".equals(type)&&!name.isEmpty())return new Shortcut("rules","","",name,"copy-rules","複製規則");
        if("rules-pending".equals(type)&&!id.isEmpty())return new Shortcut("orders","rules",id,"","email","編輯郵件");
        if("order".equals(type)&&!id.isEmpty())return new Shortcut("orders","",id,"","view","查看顧客");
        if("shortage".equals(type))return new Shortcut("inventory","shortage","",name,"view","查看庫存");
        return new Shortcut(page(fallback),filter==null?"":filter,"","","view","");
    }
    public static String url(String page,String filter,String order,String product,String action){
        page=page(page);order=identity(order);product=identity(product);
        StringBuilder q=new StringBuilder();
        boolean valid="orders".equals(page)&&("pending".equals(filter)||"registration".equals(filter)||"rules".equals(filter))||"inventory".equals(page)&&"shortage".equals(filter);
        if(valid)add(q,"widgetFilter",filter);
        if("orders".equals(page)&&!order.isEmpty()){
            add(q,"widgetOrder",order);add(q,"widgetAction","email".equals(action)?"email":"view");
        }else if(("rules".equals(page)||"inventory".equals(page))&&!product.isEmpty()){
            add(q,"widgetProduct",product);add(q,"widgetAction","rules".equals(page)&&"copy-rules".equals(action)?"copy-rules":"view");
        }
        return "https://bestloveayu.github.io/d77/"+(q.length()>0?"?"+q:"")+"#"+page;
    }
    private static void add(StringBuilder q,String key,String value){
        if(q.length()>0)q.append('&');
        try{q.append(key).append('=').append(URLEncoder.encode(value,"UTF-8").replace("+","%20"));}catch(java.io.UnsupportedEncodingException e){throw new AssertionError(e);}
    }
}

