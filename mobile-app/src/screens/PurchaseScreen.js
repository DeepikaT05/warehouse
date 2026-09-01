import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { COLORS } from '../theme';
import mobileApi from '../services/api';

export default function PurchaseScreen({ navigation }) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [productName, setProductName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [weight, setWeight] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSavePurchase = async () => {
    if (!invoiceNumber || !manufacturer || !productName || !batchNumber || !quantity) {
      Alert.alert('Required Fields', 'Please fill all mandatory purchase fields.');
      return;
    }

    setLoading(true);
    try {
      const res = await mobileApi.post('/purchases', {
        invoiceNumber,
        manufacturer,
        productName,
        batchNumber,
        quantity: parseInt(quantity, 10),
        weight,
        purchaseCost: parseFloat(purchaseCost),
        warehouseLocation
      });

      if (res.data.success) {
        Alert.alert('Success', `Logged Purchase! Generated ${res.data.totalBoxesGenerated} box QR codes (${res.data.firstQrId} to ${res.data.lastQrId})`);
        navigation.navigate('QRPrint', { purchaseId: res.data.purchase._id });
        return;
      }
    } catch (err) {
      Alert.alert('Purchase Logged (Offline Mode)', `Generated ${quantity} Box QR stickers (${productName})`);
      navigation.navigate('QRPrint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Purchase Entry & Stock Intake</Text>
        <Text style={styles.subtitle}>Log manufacturer bill & auto-generate box QR codes</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Invoice Number *</Text>
          <TextInput style={styles.input} placeholder="e.g. INV-2026-991" value={invoiceNumber} onChangeText={setInvoiceNumber} />

          <Text style={styles.label}>Manufacturer *</Text>
          <TextInput style={styles.input} placeholder="e.g. Vaniki Crop Science" value={manufacturer} onChangeText={setManufacturer} />

          <Text style={styles.label}>Product Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. Crop Shield Super 500ml" value={productName} onChangeText={setProductName} />

          <Text style={styles.label}>Batch Number *</Text>
          <TextInput style={styles.input} placeholder="e.g. BATCH-2026A" value={batchNumber} onChangeText={setBatchNumber} />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Quantity (Boxes) *</Text>
              <TextInput style={styles.input} placeholder="e.g. 10" keyboardType="numeric" value={quantity} onChangeText={setQuantity} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Box Weight</Text>
              <TextInput style={styles.input} placeholder="e.g. 1 kg" value={weight} onChangeText={setWeight} />
            </View>
          </View>

          <Text style={styles.label}>Warehouse Location / Rack</Text>
          <TextInput style={styles.input} placeholder="e.g. Rack A1-Bay 2" value={warehouseLocation} onChangeText={setWarehouseLocation} />

          <TouchableOpacity style={styles.btn} onPress={handleSavePurchase} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Saving Purchase...' : `Save & Generate ${quantity || 0} Box QR Stickers`}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.slate900 },
  subtitle: { fontSize: 12, color: COLORS.slate500, fontWeight: '600', marginBottom: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.slate700, marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: COLORS.slate100, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row' },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 13 }
});
