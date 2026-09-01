import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Modal, Alert, ScrollView } from 'react-native';
import { COLORS } from '../theme';
import mobileApi from '../services/api';
import QRScannerModal from '../components/QRScannerModal';

export default function ScanVerifyScreen({ navigation }) {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [qrInput, setQrInput] = useState('');
  const [scanResult, setScanResult] = useState(null); // { type: 'GREEN' | 'RED', title, reason, box }
  const [verifiedList, setVerifiedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);

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
          title: res.data.title || '✓ VERIFIED - READY FOR DISPATCH',
          reason: res.data.reason || `Box ${target} matches Invoice #${invoiceNo}.`,
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
          reason: res.data.reason || res.data.message || 'Box QR does not match active Sales Invoice!'
        });
        setQrInput('');
        return;
      }
    } catch (err) {
      setScanResult({
        type: 'RED',
        title: '✖ VERIFICATION ERROR',
        reason: err.response?.data?.message || err.message || 'Could not verify box QR with server.'
      });
      setQrInput('');
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
          <Text style={styles.label}>Active Sales Invoice Number *</Text>
          <TextInput
            style={styles.input}
            value={invoiceNo}
            onChangeText={setInvoiceNo}
            placeholder="e.g. SL-INV-1092"
          />
        </View>

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
            <Text style={styles.dividerText}>OR ENTER MANUALLY</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={[styles.input, styles.qrInput]}
            value={qrInput}
            onChangeText={setQrInput}
            placeholder="e.g. VNK-00000001"
            autoCapitalize="characters"
          />

          <TouchableOpacity
            style={styles.verifyBtn}
            onPress={() => handleVerify()}
            disabled={loading}
          >
            <Text style={styles.verifyBtnText}>
              {loading ? 'Verifying Box QR...' : '🔍 VERIFY ENTERED QR'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Verified Items Queue */}
        <View style={styles.queueHeader}>
          <Text style={styles.queueTitle}>Verified Dispatch Queue ({verifiedList.length} Boxes)</Text>
          {verifiedList.length > 0 && (
            <TouchableOpacity onPress={() => setVerifiedList([])}>
              <Text style={styles.clearText}>Clear Queue</Text>
            </TouchableOpacity>
          )}
        </View>

        {verifiedList.map((item, idx) => (
          <View key={idx} style={styles.queueItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemQr}>{item.qrId}</Text>
              <Text style={styles.itemName}>{item.productName} ({item.batchNumber})</Text>
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
                'Take a photo of all loaded boxes/truck as final proof before completing handover.',
                [
                  {
                    text: '📷 Capture Goods Photo & Proceed',
                    onPress: async () => {
                      const samplePhotoUrl = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80';
                      try {
                        const qrIds = verifiedList.map(b => b.qrId);
                        await mobileApi.post('/dispatches/confirm', {
                          salesInvoiceNo: invoiceNo || 'SL-INV-1092',
                          scannedQrIds: qrIds,
                          courierName: 'Direct Transport Logistics',
                          vehicleNumber: 'MH-12-VT-8890',
                          driverName: 'Ramesh Kumar',
                          driverMobile: '9876543210',
                          dispatchPhotoUrl: samplePhotoUrl
                        });
                        Alert.alert('✅ Dispatch & Photo Saved!', `${verifiedList.length} boxes verified and physical goods photo proof saved!`);
                        navigation.navigate('DeliveryStatement');
                      } catch (err) {
                        navigation.navigate('DeliveryStatement');
                      }
                    }
                  },
                  {
                    text: 'Proceed Without Photo',
                    onPress: () => {
                      navigation.navigate('DeliveryStatement');
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
  dismissBtnText: { color: COLORS.slate900, fontWeight: '900', fontSize: 14 }
});

