package tw.d77.widget;
import java.util.*;
import java.util.function.ToLongFunction;

public final class FeedOrder {
    private FeedOrder(){}
    public static <T> List<T> eventsFirst(List<T> events,List<T> todos,ToLongFunction<T> timestamp){
        List<T> result=new ArrayList<>(events);
        result.sort((a,b)->Long.compare(timestamp.applyAsLong(b),timestamp.applyAsLong(a)));
        result.addAll(todos);
        return result;
    }
}
