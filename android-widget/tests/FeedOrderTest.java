import tw.d77.widget.FeedOrder;
import java.util.*;
public final class FeedOrderTest {
    public static void main(String[] args){
        Map<String,Long> times=new HashMap<>();times.put("old",10L);times.put("new",30L);times.put("same",30L);
        List<String> events=Arrays.asList("old","new","unknown","same");
        List<String> result=FeedOrder.eventsFirst(events,Arrays.asList("todo1","todo2"),s->times.getOrDefault(s,Long.MIN_VALUE));
        if(!result.equals(Arrays.asList("new","same","old","unknown","todo1","todo2")))throw new AssertionError(result);
        if(!events.get(0).equals("old"))throw new AssertionError("Source mutated");
        if(!FeedOrder.eventsFirst(Collections.<String>emptyList(),Arrays.asList("todo"),s->0L).equals(Arrays.asList("todo")))throw new AssertionError("Empty events");
    }
}
