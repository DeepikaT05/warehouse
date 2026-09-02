import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Modal, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../theme';
import mobileApi from '../services/api';
import QRScannerModal from '../components/QRScannerModal';
import PhotoCaptureModal from '../components/PhotoCaptureModal';

export default function ScanVerifyScreen({ route, navigation }) {
  const [invoiceNo, setInvoiceNo] = useState(route?.params?.invoiceNo || route?.params?.salesInvoiceNo || '');
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [scanResult, setScanResult] = useState(null); // { type: 'GREEN' | 'RED', title, reason, box }
  const [verifiedList, setVerifiedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [photoCaptureVisible, setPhotoCaptureVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const targetInv = route?.params?.invoiceNo || route?.params?.salesInvoiceNo;
      if (targetInv) {
        setInvoiceNo(targetInv);
        fetchInvoiceInfo(targetInv);
      }
    }, [route?.params?.invoiceNo, route?.params?.salesInvoiceNo])
  );

  const fetchInvoiceInfo = async (inv) => {
    if (!inv || !inv.trim()) return;
    try {
      setInvoiceLoading(true);
      const res = await mobileApi.get('/user/orders');
      if (res.data.success && res.data.orders) {
        const found = res.data.orders.find(o => o.invoiceNo?.trim().toUpperCase() === inv.trim().toUpperCase());
        if (found) {
          setActiveInvoice(found);
        }
      }
    } catch (e) {
      console.log('Fetch invoice info err:', e.message);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleVerify = async (providedQr) => {
    let target = (providedQr || qrInput).trim().toUpperCase();

    if (!target) {
      Alert.alert('Scan QR', 'Please enter or scan a box QR ID.');
      return;
    }

    setLoading(true);

    try {
      const res = await mobileApi.post('/dispatches/verify-scan', {
        qrId: target,
        salesInvoiceNo: invoiceNo
      });

      if (res.data && res.data.verified) {
        const boxData = res.data.box;
        setScanResult({
          type: 'GREEN',
          title: res.data.title || '✓ VERIFIED - BATCH MATCH',
          reason: res.data.reason || `Box ${target} verified successfully.`,
          box: boxData
        });

        setVerifiedList(prev => {
          if (prev.some(b => b.qrId === boxData.qrId)) return prev;
          return [...prev, boxData];
        });
        setQrInput('');
        return;
      } else if (res.data && !res.data.verified) {
        setScanResult({
          type: 'RED',
          title: res.data.title || '✖ MISMATCH DETECTED',
          reason: res.data.reason || res.data.message || 'Box QR does not match active Sales Invoice or Batch!'
        });
        setQrInput('');
        return;
      }
    } catch (err) {
      setScanResult({
        type: 'RED',
        title: '✖ VERIFICATION ERROR',
        reason: err.response?.data?.reason || err.response?.data?.message || err.message || 'Could not verify box QR with server.'
      });
      setQrInput('');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteDispatch = async (photoData = '') => {
    if (!verifiedList || verifiedList.length === 0) {
      Alert.alert(
        '⚠️ No Boxes Verified',
        'Please scan and verify at least 1 box QR code before completing dispatch handover.'
      );
      return;
    }

    try {
      setLoading(true);
      const qrIds = verifiedList.map(b => b.qrId);
      const cleanInv = invoiceNo.trim() || `DSP-INV-${Date.now().toString().slice(-4)}`;
      const res = await mobileApi.post('/dispatches/confirm', {
        salesInvoiceNo: cleanInv,
        scannedQrIds: qrIds,
        courierName: 'Direct Transport Logistics',
        vehicleNumber: 'MH-12-VT-8890',
        driverName: 'Ramesh Kumar',
        driverMobile: '9876543210',
        dispatchPhotoUrl: photoData
      });

      if (res.data && res.data.success) {
        Alert.alert(
          '✅ Dispatch Completed!',
          `Statement generated for ${verifiedList.length} verified boxes.`,
          [
            {
              text: 'View Statement',
              onPress: () => {
                setVerifiedList([]);
                navigation.navigate('DeliveryStatement');
              }
            }
          ]
        );
      } else {
        Alert.alert('Dispatch Notice', res.data?.message || 'Dispatch confirmation failed.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Server error saving dispatch statement.';
      Alert.alert('Dispatch Error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  const removeVerifiedItem = (qrId) => {
    setVerifiedList(prev => prev.filter(b => b.qrId !== qrId));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dispatch Verification Guard</Text>
          <Text style={styles.subtitle}>Scan every box QR before loading onto vehicle</Text>
        </View>

        {/* Invoice Selector Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Active Sales Invoice Number</Text>
          <TextInput
            style={styles.input}
            value={invoiceNo}
            onChangeText={(text) => {
              setInvoiceNo(text);
              fetchInvoiceInfo(text);
            }}
            placeholder="e.g. SL-INV-7654"
          />
        </View>

        {/* REQUIRED PRODUCTS & BATCH DETAILS CARD */}
        {activeInvoice && (
          <View style={styles.billRequiredCard}>
            <View style={styles.billHeaderRow}>
              <Text style={styles.billTitle}>Required Items for Bill #{activeInvoice.invoiceNo}</Text>
              <Text style={styles.billDealer}>{activeInvoice.dealerName} ({activeInvoice.garageName || 'Store'})</Text>
            </View>

            <View style={styles.requiredItemsList}>
              {activeInvoice.items?.map((item, idx) => {
                const verifiedCount = verifiedList.filter(b => {
                  const bName = (b.productName || '').toLowerCase().trim();
                  const iName = (item.productName || '').toLowerCase().trim();
                  const nameMatch = bName === iName || bName.includes(iName) || iName.includes(bName);
                  const bBatch = (b.batchNumber || '').toLowerCase().trim();
                  const iBatch = (item.batchNumber || '').toLowerCase().trim();
                  const batchMatch = !iBatch || iBatch === 'any' || bBatch === iBatch;
                  return nameMatch && batchMatch;
                }).length;
                const isItemDone = verifiedCount >= (item.quantity || 1);

                return (
                  <View key={idx} style={[styles.requiredItemRow, isItemDone && styles.requiredItemRowDone]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.requiredItemName}>• {item.productName}</Text>
                      <Text style={styles.requiredItemBatch}>
                        Required Batch: <Text style={{ fontWeight: '900', color: '#0F6E56' }}>{item.batchNumber || 'Any Batch'}</Text>
                      </Text>
                    </View>
                    <View style={[styles.qtyBadge, isItemDone ? styles.qtyBadgeDone : styles.qtyBadgePending]}>
                      <Text style={[styles.qtyBadgeText, isItemDone ? styles.qtyTextDone : styles.qtyTextPending]}>
                        {verifiedCount} / {item.quantity || 1} {isItemDone ? '✓' : 'Boxes'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* QR Scan Input Card */}
        <View style={styles.scanCard}>
          <Text style={styles.scanTitle}>Scan or Enter Box QR ID</Text>

          <TouchableOpacity
            style={styles.cameraScanBtn}
            onPress={() => setCameraVisible(true)}
          >
            <Text style={styles.cameraScanBtnText}>📷 OPEN PHONE CAMERA SCANNER</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR TYPE QR CODE</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={[styles.input, styles.qrInput]}
            value={qrInput}
            onChangeText={setQrInput}
            placeholder="e.g. VNK-1"
            autoCapitalize="characters"
          />

          <TouchableOpacity
            style={styles.verifyBtn}
            onPress={() => handleVerify()}
            disabled={loading}
          >
            <Text style={styles.verifyBtnText}>{loading ? 'Verifying...' : 'VERIFY BOX'}</Text>
          </TouchableOpacity>
        </View>

        {/* Verified Boxes Queue */}
        {verifiedList.length > 0 && (
          <View style={styles.queueHeader}>
            <Text style={styles.queueTitle}>Verified Loaded Boxes ({verifiedList.length})</Text>
            <TouchableOpacity onPress={() => setVerifiedList([])}>
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        )}

        {verifiedList.map((item, idx) => (
          <View key={idx} style={styles.queueItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemQr}>{item.qrId}</Text>
              <Text style={styles.itemName}>{item.productName} ({item.batchNumber || 'Batch-2026'})</Text>
            </View>
            <View style={styles.verifiedTag}>
              <Text style={styles.verifiedText}>VERIFIED</Text>
            </View>
            <TouchableOpacity onPress={() => removeVerifiedItem(item.qrId)} style={styles.removeBtn}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {verifiedList.length > 0 && (
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => {
              Alert.alert(
                '📷 Final Step: Capture Goods Photo Proof',
                'Take a real photo of all loaded boxes/truck as physical proof before completing handover.',
                [
                  {
                    text: '📷 Capture Goods Photo & Proceed',
                    onPress: () => {
                      setPhotoCaptureVisible(true);
                    }
                  },
                  {
                    text: 'Proceed Without Photo',
                    onPress: () => {
                      handleCompleteDispatch('');
                    }
                  }
                ]
              );
            }}
          >
            <Text style={styles.confirmBtnText}>🚚 📷 Capture Photo & Generate Handover Sheet</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* LIVE CAMERA GOODS PHOTO PROOF MODAL */}
      <PhotoCaptureModal
        visible={photoCaptureVisible}
        onClose={() => setPhotoCaptureVisible(false)}
        title="📷 Take Dispatched Goods Photo"
        onPhotoCaptured={(photoData) => {
          setPhotoCaptureVisible(false);
          handleCompleteDispatch(photoData);
        }}
      />

      {/* LIVE CAMERA QR SCANNER MODAL */}
      <QRScannerModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onScan={(scannedQr) => {
          setCameraVisible(false);
          handleVerify(scannedQr);
        }}
      />

      {/* GREEN SCREEN / RED SCREEN OVERLAY MODAL */}
      {scanResult && (
        <Modal visible transparent animationType="fade">
          <View style={[styles.overlay, scanResult.type === 'GREEN' ? styles.bgGreen : styles.bgRed]}>
            <View style={styles.overlayIconCircle}>
              <Text style={styles.overlayIcon}>{scanResult.type === 'GREEN' ? '✓' : '✖'}</Text>
            </View>

            <Text style={styles.overlayTitle}>{scanResult.title}</Text>
            <Text style={styles.overlayReason}>{scanResult.reason}</Text>

            {scanResult.box && (
              <View style={styles.boxInfoCard}>
                <Text style={styles.boxInfoQr}>ID: {scanResult.box.qrId}</Text>
                <Text style={styles.boxInfoProd}>{scanResult.box.productName}</Text>
                <Text style={styles.boxInfoBatch}>Batch: {scanResult.box.batchNumber || '2026A'}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.dismissBtn} onPress={() => setScanResult(null)}>
              <Text style={styles.dismissBtnText}>SCAN NEXT BOX ➔</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  header: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.slate900 },
  subtitle: { fontSize: 12, color: COLORS.slate500, fontWeight: '600', marginTop: 2 },
  card: { backgroundColor: '#FFF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.slate700, marginBottom: 4 },
  input: { backgroundColor: COLORS.slate100, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '700', color: COLORS.slate900 },
  scanCard: { backgroundColor: '#FFF', padding: 18, borderRadius: 16, borderWidth: 2, borderColor: COLORS.primary, marginBottom: 16 },
  scanTitle: { fontSize: 13, fontWeight: '900', color: COLORS.primary, marginBottom: 12 },
  cameraScanBtn: { backgroundColor: '#0284C7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', shadowColor: '#0284C7', shadowOpacity: 0.3, elevation: 4 },
  cameraScanBtnText: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { marginHorizontal: 10, fontSize: 10, fontWeight: '800', color: COLORS.slate500 },
  qrInput: { fontSize: 16, fontFamily: 'monospace', color: COLORS.primary, marginBottom: 12 },
  verifyBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, elevation: 4 },
  verifyBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  queueTitle: { fontSize: 12, fontWeight: '800', color: COLORS.slate700 },
  clearText: { fontSize: 11, color: COLORS.danger, fontWeight: '700' },
  queueItem: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  itemQr: { fontSize: 12, fontWeight: '900', fontFamily: 'monospace', color: COLORS.primary },
  itemName: { fontSize: 11, color: COLORS.slate700, fontWeight: '600', marginTop: 2 },
  verifiedTag: { backgroundColor: COLORS.bgLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8 },
  verifiedText: { color: COLORS.primary, fontWeight: '900', fontSize: 10 },
  removeBtn: { padding: 4 },
  removeText: { color: COLORS.danger, fontWeight: '900', fontSize: 14 },
  confirmBtn: { backgroundColor: COLORS.success, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  confirmBtnText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  bgGreen: { backgroundColor: '#1D9E75' }, // Success Verified Screen
  bgRed: { backgroundColor: '#E53E3E' },   // Mismatch Alert Screen
  overlayIconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  overlayIcon: { fontSize: 50, color: '#FFF', fontWeight: '900', textAlign: 'center' },
  overlayTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  overlayReason: { fontSize: 13, fontWeight: '600', color: '#FFF', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  boxInfoCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, width: '100%', alignItems: 'center', marginBottom: 24 },
  boxInfoQr: { fontSize: 16, fontWeight: '900', fontFamily: 'monospace', color: COLORS.primary },
  boxInfoProd: { fontSize: 13, fontWeight: '700', color: COLORS.slate900, marginTop: 4 },
  boxInfoBatch: { fontSize: 11, color: COLORS.slate500, marginTop: 2 },
  dismissBtn: { backgroundColor: '#FFF', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.2, elevation: 4 },
  dismissBtnText: { color: COLORS.slate900, fontWeight: '900', fontSize: 14 },
  billRequiredCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#0F6E56', marginBottom: 14 },
  billHeaderRow: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', pb: 8, marginBottom: 8 },
  billTitle: { fontSize: 13, fontWeight: '900', color: '#0F6E56' },
  billDealer: { fontSize: 11, fontWeight: '700', color: '#64748B', marginTop: 2 },
  requiredItemsList: { marginTop: 4 },
  requiredItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  requiredItemRowDone: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  requiredItemName: { fontSize: 12, fontWeight: '800', color: '#1E293B' },
  requiredItemBatch: { fontSize: 11, color: '#64748B', marginTop: 2 },
  qtyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  qtyBadgeDone: { backgroundColor: '#D1FAE5' },
  qtyBadgePending: { backgroundColor: '#FEF3C7' },
  qtyBadgeText: { fontSize: 11, fontWeight: '900' },
  qtyTextDone: { color: '#065F46' },
  qtyTextPending: { color: '#92400E' }
});

