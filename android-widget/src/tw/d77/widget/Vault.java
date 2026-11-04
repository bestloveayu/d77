package tw.d77.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class Vault {
    private static final String ALIAS = "d77.widget.state.v1";
    private final SharedPreferences prefs;
    Vault(Context c) { prefs = c.getSharedPreferences("widget", Context.MODE_PRIVATE); }
    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (!ks.containsAlias(ALIAS)) {
            KeyGenerator g = KeyGenerator.getInstance("AES", "AndroidKeyStore");
            g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            g.generateKey();
        }
        return (SecretKey) ks.getKey(ALIAS, null);
    }
    synchronized JSONObject read() {
        try {
            String raw = prefs.getString("sealed", "");
            if (raw.isEmpty()) return new JSONObject();
            String[] p = raw.split(":", 2);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(p[0], Base64.NO_WRAP)));
            c.updateAAD(ALIAS.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return new JSONObject(new String(c.doFinal(Base64.decode(p[1], Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) { clear(); return new JSONObject(); }
    }
    synchronized void write(JSONObject value) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.ENCRYPT_MODE, key());
        c.updateAAD(ALIAS.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String sealed = Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(c.doFinal(value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)), Base64.NO_WRAP);
        if (!prefs.edit().putString("sealed", sealed).commit()) throw new java.io.IOException("Storage unavailable");
    }
    void clear() { prefs.edit().remove("sealed").commit(); }
    String theme(int id) { return prefs.getString("theme." + id, "system"); }
    void theme(int id, String mode) { prefs.edit().putString("theme." + id, mode).apply(); }
    void remove(int id) { prefs.edit().remove("theme." + id).apply(); }
}
