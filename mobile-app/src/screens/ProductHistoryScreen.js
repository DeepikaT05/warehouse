import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS } from '../theme';
import mobileApi from '../services/api';
import QRScannerModal from '../components/QRScannerModal';

export default function ProductHistoryScreen() {
  const [qrQuery, setQrQuery] = useState('VNK-00000001');
  const [cameraVisible, setCameraVisible] = useState(false);
  const [boxData, setBoxData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (qrQuery) fetchBoxHistory(qrQuery);
  }, []);

  const fetchBoxHistory = async (targetQr) => {
    if (!targetQr) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await mobileApi.get(`/stock/qr/${targetQr.trim()}`);
      if (res.data.success && res.data.box) {
        setBoxData(res.data.box);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || `No inventory record found for '${targetQr}'`);
      setBoxData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Product Lifecycle History & Audit Trail</Text>
        <Text style={styles.subtitle}>Trace full audit timeline for any box QR identity</Text>

        <View style={styles.searchBox}>
          <TouchableOpacity 
            style={styles.scanBtn}
            onPress={() => setCameraVisible(true)}
          >
            <Text style={styles.scanBtnText}>📷 SCAN QR WITH PHONE CAMERA</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={qrQuery}
            onChangeText={setQrQuery}
            placeholder="Enter Box QR ID..."
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.btn} onPress={() => fetchBoxHistory(qrQuery)}>
            <Text style={styles.btnText}>Trace Box History</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />}

        {errorMsg && (
          <View style={[styles.eventContent, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', marginBottom: 16 }]}>
            <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 12 }}>{errorMsg}</Text>
          </View>
        )}

        {boxData && (
          <View style={{ marginBottom: 16 }}>
            <View style={[styles.eventContent, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', marginBottom: 12 }]}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: COLORS.slate900 }}>{boxData.productName}</Text>
              <Text style={{ fontSize: 11, color: COLORS.slate600, marginTop: 2 }}>
                Batch: {boxData.batchNumber} | Rack: {boxData.warehouseLocation} | Status: {boxData.status?.toUpperCase()}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '800', marginTop: 2 }}>
                Manufacturer: {boxData.manufacturer}
              </Text>
            </View>

            <Text style={styles.timelineHeader}>Box History Timeline ({boxData.qrId}):</Text>
            <View style={styles.timelineContainer}>
              {(boxData.history && boxData.history.length > 0 ? boxData.history : [
                { stage: 'QR Generated', title: 'Box Registered', description: `Registered box ${boxData.qrId}`, timestamp: boxData.createdAt }
              ]).map((evt, idx) => (
                <View key={idx} style={styles.timelineItem}>
                  <View style={styles.nodeCircle}>
                    <Text style={styles.nodeIcon}>✓</Text>
                  </View>
                  <View style={styles.eventContent}>
                    <View style={styles.row}>
                      <Text style={styles.stageTag}>{evt.stage}</Text>
                      <Text style={styles.timeText}>{evt.timestamp ? new Date(evt.timestamp).toLocaleString() : ''}</Text>
                    </View>
                    <Text style={styles.eventTitle}>{evt.title}</Text>
                    <Text style={styles.eventDesc}>{evt.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* CAMERA SCANNER MODAL */}
      <QRScannerModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onScan={(code) => {
          setCameraVisible(false);
          setQrQuery(code);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.slate900 },
  subtitle: { fontSize: 12, color: COLORS.slate500, fontWeight: '600', marginBottom: 16 },
  searchBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  scanBtn: { backgroundColor: '#0284C7', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  scanBtnText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  input: { backgroundColor: COLORS.slate100, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'monospace', fontWeight: '800', color: COLORS.primary, marginBottom: 10 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  timelineHeader: { fontSize: 13, fontWeight: '800', color: COLORS.slate700, marginBottom: 12 },
  timelineContainer: { borderLeftWidth: 2, borderLeftColor: COLORS.primary, marginLeft: 10, paddingLeft: 16 },
  timelineItem: { marginBottom: 16, position: 'relative' },
  nodeCircle: { position: 'absolute', left: -25, top: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  nodeIcon: { color: '#FFF', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  eventContent: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stageTag: { backgroundColor: COLORS.bgLight, color: COLORS.primary, fontWeight: '900', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  timeText: { fontSize: 10, color: COLORS.slate500 },
  eventTitle: { fontSize: 12, fontWeight: '800', color: COLORS.slate900, marginTop: 4 },
  eventDesc: { fontSize: 11, color: COLORS.slate600, marginTop: 2 }
});
