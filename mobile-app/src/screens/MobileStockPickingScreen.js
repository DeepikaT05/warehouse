import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import mobileApi from '../services/api';

export default function MobileStockPickingScreen({ route, navigation }) {
  const { orderId } = route.params || {};

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanProcessing, setScanProcessing] = useState(false);
  const [scanAlert, setScanAlert] = useState(null);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const res = await mobileApi.get(`/user/orders/${orderId}`);
      if (res.data.success) {
        setOrder(res.data.order);
      }
    } catch (err) {
      console.error('Fetch order error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanSubmit = async () => {
    if (!barcodeInput.trim()) return;

    setScanProcessing(true);
    setScanAlert(null);

    try {
      const res = await mobileApi.post(`/user/orders/${orderId}/scan-item`, {
        barcode: barcodeInput.trim()
      });

      if (res.data.valid) {
        setScanAlert({
          type: 'success',
          title: res.data.alreadyPicked ? 'Already Picked' : '✓ Item Picked Successfully',
          message: res.data.message
        });
        setBarcodeInput('');
        fetchOrderDetails();
      } else {
        setScanAlert({
          type: 'error',
          title: res.data.title || 'Wrong Item Scanned',
          message: res.data.message || 'Product or batch does not match bill.'
        });
        setBarcodeInput('');
      }
    } catch (err) {
      setScanAlert({
        type: 'error',
        title: 'Scan Error',
        message: err.response?.data?.message || err.message
      });
    } finally {
      setScanProcessing(false);
    }
  };

  const handleCompletePicking = async () => {
    try {
      const res = await mobileApi.post(`/user/orders/${orderId}/complete-picking`);
      if (res.data.success) {
        Alert.alert('Success', 'Stock picking completed!');
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F6E56" />
        <Text style={styles.loadingText}>Loading picking session...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Order not found.</Text>
      </View>
    );
  }

  const totalRequired = order.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;
  const totalPicked = order.pickedItems?.length || 0;
  const isFullyPicked = totalPicked >= totalRequired;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Summary */}
      <View style={styles.headerCard}>
        <Text style={styles.orderNo}>Bill #{order.invoiceNo}</Text>
        <Text style={styles.dealerName}>Dealer: {order.dealerName}</Text>
        <Text style={styles.progressText}>Picked {totalPicked} of {totalRequired} Units</Text>

        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${totalRequired > 0 ? (totalPicked / totalRequired) * 100 : 0}%` }]} />
        </View>
      </View>

      {/* Barcode / QR Scan Section */}
      <View style={styles.scanSection}>
        <Text style={styles.sectionTitle}>Scan Product Sticker Barcode / QR</Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Scan QR sticker or enter VNK-..."
            placeholderTextColor="#94A3B8"
            value={barcodeInput}
            onChangeText={setBarcodeInput}
            onSubmitEditing={handleScanSubmit}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.scanBtn, scanProcessing && { opacity: 0.6 }]}
            onPress={handleScanSubmit}
            disabled={scanProcessing}
          >
            <Text style={styles.scanBtnText}>{scanProcessing ? '...' : 'SCAN'}</Text>
          </TouchableOpacity>
        </View>

        {scanAlert && (
          <View style={[styles.alertBox, scanAlert.type === 'success' ? styles.alertSuccess : styles.alertError]}>
            <Text style={scanAlert.type === 'success' ? styles.alertTitleSuccess : styles.alertTitleError}>{scanAlert.title}</Text>
            <Text style={styles.alertMessage}>{scanAlert.message}</Text>
          </View>
        )}
      </View>

      {/* Required Bill Items */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Required Bill Items</Text>
        {order.items?.map((item, idx) => {
          const pickedCount = order.pickedItems?.filter(p =>
            p.productName.toLowerCase().trim() === item.productName.toLowerCase().trim()
          ).length || 0;

          const done = pickedCount >= item.quantity;

          return (
            <View key={idx} style={[styles.itemRow, done && styles.itemRowDone]}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemProductName}>{item.productName}</Text>
                {item.batchNumber ? <Text style={styles.itemBatch}>Batch: {item.batchNumber}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.itemQty, done && styles.itemQtyDone]}>{pickedCount} / {item.quantity}</Text>
                {!done && (
                  <TouchableOpacity
                    style={{ backgroundColor: '#0F6E56', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
                    onPress={() => {
                      setBarcodeInput(item.productName);
                      handleScanSubmit();
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>+ PICK</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[styles.completeBtn, !isFullyPicked && styles.completeBtnDisabled]}
        onPress={handleCompletePicking}
        disabled={!isFullyPicked}
      >
        <Text style={styles.completeBtnText}>
          {isFullyPicked ? '✓ Complete Stock Picking' : `Picking In Progress (${totalPicked}/${totalRequired})`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 14, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#64748B', fontSize: 13 },
  headerCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderBorderWidth: 1, borderColor: '#E2E8F0', elevation: 2, marginBottom: 14 },
  orderNo: { fontSize: 18, fontWeight: '900', color: '#0F6E56' },
  dealerName: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginTop: 2 },
  progressText: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 10, marginBottom: 4 },
  progressBarBg: { height: 10, backgroundColor: '#E2E8F0', borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#0F6E56', borderRadius: 5 },
  scanSection: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '700', color: '#0F172A' },
  scanBtn: { backgroundColor: '#0F6E56', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  scanBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  alertBox: { marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  alertSuccess: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  alertError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  alertTitleSuccess: { fontWeight: '900', color: '#065F46', fontSize: 12 },
  alertTitleError: { fontWeight: '900', color: '#991B1B', fontSize: 12 },
  alertMessage: { fontSize: 11, color: '#334155', marginTop: 2 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, marginBottom: 14 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemRowDone: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, borderRadius: 8 },
  itemLeft: { flex: 1 },
  itemProductName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  itemBatch: { fontSize: 11, color: '#64748B', marginTop: 1 },
  itemQty: { fontSize: 13, fontWeight: '900', color: '#D97706' },
  itemQtyDone: { color: '#059669' },
  completeBtn: { backgroundColor: '#0F6E56', borderRadius: 14, paddingVertical: 14, alignItems: 'center', elevation: 3 },
  completeBtnDisabled: { backgroundColor: '#94A3B8' },
  completeBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 }
});
