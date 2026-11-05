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
            int t=0,e=0,tc=todos==null?0:todos.length(),ec=events==null?0:events.length();
            while((t<tc||e<ec)&&next.size()<64){
                if(t<tc){JSONObject item=todos.optJSONObject(t++);if(item!=null)next.add(item);}
                if(e<ec){JSONObject item=events.optJSONObject(e++);if(item!=null)next.add(item);}
            }
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
            row.setOnClickFillInIntent(R.id.row,new Intent().putExtra("page",OpenActivity.page(item.optString("page"))));
            row.setContentDescription(R.id.row,title+"，"+body);
            return row;
        }
        public int getCount(){return items.size();}
        public RemoteViews getLoadingView(){return null;}
        public int getViewTypeCount(){return 1;}
        public long getItemId(int position){return position;}
        public boolean hasStableIds(){return false;}
        public void onDestroy(){items=Collections.emptyList();}
        private static String clean(String text,int max){text=text.replaceAll("[\\p{Cntrl}]"," ");return text.substring(0,Math.min(text.length(),max));}
        private static String time(String text){try{return java.time.Instant.parse(text).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"));}catch(Exception ignored){return "";}}
    }
}
