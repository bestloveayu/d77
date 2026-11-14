package tw.d77.widget;

import android.appwidget.AppWidgetManager;
import android.content.*;
import android.content.res.Configuration;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import android.graphics.Color;
import org.json.*;
import java.util.*;

public final class FeedService extends RemoteViewsService {
    @Override public RemoteViewsFactory onGetViewFactory(Intent intent){return new Factory(getApplicationContext(),intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,-1));}
    private static final class Factory implements RemoteViewsFactory {
        final Context context;final int widgetId;
        List<JSONObject> items=Collections.emptyList();boolean dark,paired;
        Factory(Context c,int id){context=c;widgetId=id;}
        public void onCreate(){onDataSetChanged();}
        public void onDataSetChanged(){
            Vault vault=new Vault(context);JSONObject state=vault.read();
            paired=!state.optString("token").isEmpty()&&!Session.expired(state);
            String mode=vault.theme(widgetId);
            dark="night".equals(mode)||"system".equals(mode)&&(context.getResources().getConfiguration().uiMode&Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;
            JSONObject data=paired?state.optJSONObject("data"):null;
            ArrayList<JSONObject> next=new ArrayList<>();
            JSONArray todos=data==null?null:data.optJSONArray("todos"),events=data==null?null:data.optJSONArray("events");
            List<JSONObject> eventRows=rows(events),todoRows=rows(todos);
            next.addAll(FeedOrder.eventsFirst(eventRows,todoRows,item->{try{return java.time.Instant.parse(item.optString("time")).toEpochMilli();}catch(Exception ignored){return Long.MIN_VALUE;}}));
            if(next.size()>64)next.subList(64,next.size()).clear();
            if(next.isEmpty())try{next.add(new JSONObject().put("title",paired?"目前沒有新待辦":"請先配對小工具").put("body",paired?"同步後會顯示最新資訊":"開啟東77小工具 App 連結帳戶"));}catch(JSONException ignored){}
            items=next;
        }
        public RemoteViews getViewAt(int position){
            if(position<0||position>=items.size())return null;
            JSONObject item=items.get(position);String title=clean(item.optString("title"),80),body=clean(item.optString("body"),220);
            RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.widget_row);
            int foreground=Color.parseColor(dark?"#F0F3E9":"#183E2C"),muted=Color.parseColor(dark?"#B7CABB":"#526A59");
            row.setTextViewText(R.id.row_title,title);row.setTextViewText(R.id.row_body,body);
            row.setTextColor(R.id.row_title,foreground);row.setTextColor(R.id.row_body,muted);row.setTextColor(R.id.row_time,muted);
            row.setInt(R.id.row_line,"setBackgroundColor",Color.parseColor(dark?"#436456":"#D2DDD7"));
            row.setTextViewTextSize(R.id.row_title,android.util.TypedValue.COMPLEX_UNIT_SP,18);
            row.setTextViewTextSize(R.id.row_body,android.util.TypedValue.COMPLEX_UNIT_SP,13);
            row.setTextViewText(R.id.row_time,time(item.optString("time")));
            String icon=title.contains("規則")?"ic_book":title.contains("寄")?"ic_mail":title.contains("出貨")?"ic_package":title.contains("庫存")||title.contains("缺貨")||title.contains("進貨")?"ic_box":"ic_task";
            row.setImageViewResource(R.id.row_icon,context.getResources().getIdentifier(icon+(dark?"_dark":""),"drawable",context.getPackageName()));
            JSONObject target=item.optJSONObject("target");
            Shortcut shortcut=Shortcut.resolve(item.optString("type"),target==null?"":target.optString("id"),target==null?"":target.optString("name"),item.optString("page"),item.optString("filter"));
            Intent link=new Intent().putExtra("page",shortcut.page).putExtra("filter",shortcut.filter).putExtra("order",shortcut.order).putExtra("product",shortcut.product).putExtra("action",shortcut.action);
            row.setOnClickFillInIntent(R.id.row,link);
            row.setContentDescription(R.id.row,title+"，"+body);
            return row;
        }
        public int getCount(){return items.size();}
        public RemoteViews getLoadingView(){return null;}
        public int getViewTypeCount(){return 1;}
        public long getItemId(int position){return position;}
        public boolean hasStableIds(){return false;}
        public void onDestroy(){items=Collections.emptyList();}
        private static List<JSONObject> rows(JSONArray values){
            List<JSONObject> result=new ArrayList<>();
            if(values!=null)for(int i=0;i<Math.min(64,values.length());i++){JSONObject value=values.optJSONObject(i);if(value!=null)result.add(value);}
            return result;
        }
        private static String clean(String text,int max){text=text.replaceAll("[\\p{Cntrl}]"," ");return text.substring(0,Math.min(text.length(),max));}
        private static String time(String text){try{return java.time.Instant.parse(text).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"));}catch(Exception ignored){return "";}}
    }
}

