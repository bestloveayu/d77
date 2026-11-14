import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.*;

public final class RowStructureTest {
    public static void main(String[] args) throws Exception {
        Path root=Paths.get(args[0]);
        DocumentBuilderFactory factory=DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        Document layout=factory.newDocumentBuilder().parse(root.resolve("res/layout/widget_row.xml").toFile());
        NodeList views=layout.getElementsByTagName("*");
        for(int i=0;i<views.getLength();i++){
            Element view=(Element)views.item(i);
            if(view.getAttributeNS("http://schemas.android.com/apk/res/android","id").contains("row_action"))
                throw new AssertionError("Row must not contain quick-action views");
        }
        try(java.util.stream.Stream<Path> files=Files.walk(root.resolve("src"))){
            for(Path file:(Iterable<Path>)files.filter(p->p.toString().endsWith(".java"))::iterator)
                if(new String(Files.readAllBytes(file),StandardCharsets.UTF_8).contains("row_action"))
                    throw new AssertionError("Quick-action binding remains: "+file);
        }
        System.out.println("RowStructureTest passed: no quick-action views or source bindings");
    }
}

