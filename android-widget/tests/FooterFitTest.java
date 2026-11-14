import java.awt.Font;
import java.awt.font.FontRenderContext;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.*;

public final class FooterFitTest {
    public static void main(String[] args) throws Exception {
        Path root=Paths.get(args[0]);
        String source=new String(Files.readAllBytes(root.resolve("src/tw/d77/widget/BoardWidget.java")),StandardCharsets.UTF_8);
        String label="\u65b0\u589e\u9810\u8cfc";
        if(!source.contains("String[] labels = {\""+label+"\""))throw new AssertionError("Runtime purchase label");
        DocumentBuilderFactory factory=DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        Document layout=factory.newDocumentBuilder().parse(root.resolve("res/layout/widget_board.xml").toFile());
        NodeList views=layout.getElementsByTagName("TextView");
        boolean found=false;
        for(int i=0;i<views.getLength();i++){
            Element view=(Element)views.item(i);
            if("@+id/purchase_label".equals(view.getAttributeNS("http://schemas.android.com/apk/res/android","id"))){
                found=true;
                if(!label.equals(view.getAttributeNS("http://schemas.android.com/apk/res/android","text")))throw new AssertionError("XML purchase label");
            }
        }
        if(!found)throw new AssertionError("Missing purchase label");
        Font regular=Font.createFont(Font.TRUETYPE_FONT,root.resolve("res/font/widget_serif.ttf").toFile());
        Font bold=Font.createFont(Font.TRUETYPE_FONT,root.resolve("res/font/widget_serif_semibold.ttf").toFile());
        FontRenderContext frc=new FontRenderContext(null,true,true);
        String[] labels={label,"\u5f85\u51fa\u8ca8","\u5f85\u5bc4","\u7f3a\u8ca8"};
        double[] weights={1,1,1,1};
        String[] ids={"purchase","shipment","rules","shortage"};
        NodeList containers=layout.getElementsByTagName("LinearLayout");
        for(int i=0;i<containers.getLength();i++){
            Element view=(Element)containers.item(i);
            for(int n=0;n<ids.length;n++)if(("@+id/"+ids[n]).equals(view.getAttributeNS("http://schemas.android.com/apk/res/android","id"))){
                String weight=view.getAttributeNS("http://schemas.android.com/apk/res/android","layout_weight");
                if(!weight.isEmpty())weights[n]=Double.parseDouble(weight);
            }
        }
        double total=0;for(double weight:weights)total+=weight;
        int fourDigitOverflows=0;
        // Host font-metric model: 320dp width, default font scale, all 0-999 counts.
        for(int rows=2;rows<=5;rows++){
            int height=70*rows-30;
            int labelSize=height>=320?11:10,valueSize=height>=320?18:16;
            for(int n=0;n<labels.length;n++)for(int number=0;number<=1000;number++){
                String count=String.valueOf(number==1000?9999:number);
                double available=Math.floor((320-24-3)*weights[n]/total);
                double needed=regular.deriveFont((float)labelSize).getStringBounds(labels[n],frc).getWidth()+3
                    +bold.deriveFont((float)valueSize).getStringBounds(count,frc).getWidth();
                if(needed>available){
                    String message="4x"+rows+" "+ids[n]+" count "+count+": "+needed+" > "+available;
                    if(number<1000)throw new AssertionError("Footer overflow: "+message);
                    fourDigitOverflows++;System.out.println("9999 fit limit: "+message);
                }
            }
        }
        System.out.println("FooterFitTest passed: label contract; 4x2-4x5 host font metrics at 320dp, scale 1, all counts 0-999; 9999 overflow cases="+fourDigitOverflows);
    }
}

