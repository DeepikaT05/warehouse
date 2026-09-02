import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Image, Modal, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../theme';
import mobileApi from '../services/api';
import PhotoCaptureModal from '../components/PhotoCaptureModal';

export default function DeliveryStatementScreen() {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewPhotoUrl, setViewPhotoUrl] = useState(null);
  const [activeDispatchForPhoto, setActiveDispatchForPhoto] = useState(null);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  const fetchDispatches = async () => {
    try {
      const res = await mobileApi.get('/dispatches');
      if (res.data.success) {
        setDispatches(res.data.dispatches || []);
      }
    } catch (err) {
      console.error('Fetch dispatches error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDispatches();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDispatches();
  };

  const handleWhatsApp = (item) => {
    const text = `*VANIKI CROP SCIENCE - DELIVERY STATEMENT*\n\nStatement No: ${item.dispatchNo}\nInvoice: ${item.salesInvoiceNo}\nDealer: ${item.dealerId?.firmName || item.dealerId?.dealerName || 'N/A'}\nCourier: ${item.courierName}\nVehicle: ${item.vehicleNumber}\nTotal Verified Boxes: ${item.scannedBoxQrIds?.length || 0}${item.dispatchPhotoUrl ? '\nPhoto Proof: ATTACHED & STORED' : ''}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const handleCaptureGoodsPhoto = (item) => {
    setActiveDispatchForPhoto(item);
    setPhotoModalVisible(true);
  };

  const handleSaveCapturedPhoto = async (photoData) => {
    if (!activeDispatchForPhoto) return;
    try {
      const res = await mobileApi.post('/dispatches/upload-photo', {
        dispatchId: activeDispatchForPhoto._id,
        salesInvoiceNo: activeDispatchForPhoto.salesInvoiceNo,
        photoUrl: photoData
      });
      if (res.data.success) {
        Alert.alert('✅ Photo Saved!', 'Dispatched goods photo proof stored successfully.');
        fetchDispatches();
      }
    } catch (err) {
      Alert.alert('Upload Error', 'Could not save photo proof.');
    } finally {
      setPhotoModalVisible(false);
      setActiveDispatchForPhoto(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary || '#0F6E56']} />
        }
      >
        <Text style={styles.title}>Delivery Statements & Handover ({dispatches.length})</Text>
        <Text style={styles.subtitle}>Generated delivery statements with QR list & goods photo proof</Text>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
        ) : dispatches.length === 0 ? (
          <View style={styles.card}>
            <Text style={{ textAlign: 'center', color: COLORS.slate500, fontSize: 13, padding: 10 }}>
              No delivery statements generated yet.
            </Text>
          </View>
        ) : (
          dispatches.map((item) => (
            <View key={item._id} style={[styles.card, { marginBottom: 16 }]}>
              <View style={styles.headerBanner}>
                <Text style={styles.company}>VANIKI CROP SCIENCE</Text>
                <Text style={styles.stmtNo}>Statement #{item.dispatchNo}</Text>
              </View>

              <Text style={styles.label}>Invoice Number</Text>
              <Text style={styles.val}>#{item.salesInvoiceNo}</Text>

              <Text style={styles.label}>Dealer & Delivery Destination</Text>
              <Text style={styles.val}>{item.dealerId?.dealerName || item.dealerId?.firmName || 'N/A'}</Text>
              {item.dealerId?.garageName ? (
                <Text style={styles.subVal}>Branch / Store: <Text style={{ fontWeight: '800', color: '#0F6E56' }}>{item.dealerId.garageName}</Text></Text>
              ) : null}
              {item.dealerId?.address || item.dealerId?.city ? (
                <Text style={styles.subVal}>
                  📍 {[item.dealerId?.address, item.dealerId?.city, item.dealerId?.state, item.dealerId?.pincode].filter(Boolean).join(', ')}
                </Text>
              ) : null}
              {item.dealerId?.phone ? (
                <Text style={styles.subVal}>📞 Phone: {item.dealerId.phone}</Text>
              ) : null}
              {item.dealerId?.gstNumber ? (
                <Text style={styles.subVal}>GSTIN: <Text style={{ fontFamily: 'monospace', fontWeight: '800' }}>{item.dealerId.gstNumber}</Text></Text>
              ) : null}

              <Text style={styles.label}>Logistics & Courier Info</Text>
              <Text style={styles.val}>{item.courierName} | Vehicle: {item.vehicleNumber}</Text>
              <Text style={styles.subVal}>Driver: {item.driverName} ({item.driverMobile})</Text>
              <Text style={styles.subVal}>Date: {new Date(item.dispatchDate || Date.now()).toLocaleDateString()}</Text>

              <Text style={styles.label}>Verified Dispatched Boxes ({item.scannedBoxQrIds?.length || 0})</Text>
              <View style={styles.boxGrid}>
                {item.scannedBoxQrIds?.map((qr, idx) => (
                  <Text key={idx} style={styles.boxBadge}>{qr}</Text>
                ))}
              </View>

              {/* PDF DOWNLOAD BUTTON */}
              <TouchableOpacity
                style={styles.pdfBtn}
                onPress={() => Linking.openURL(`https://warehouse.vanikicrop.com/api/dispatches/${item._id}/pdf`)}
              >
                <Text style={styles.pdfBtnText}>📄 Download Official Statement PDF</Text>
              </TouchableOpacity>

              {/* DISPATCHED GOODS PHOTO PROOF SECTION */}
              <View style={styles.photoSection}>
                <Text style={styles.photoSectionTitle}>📷 Physical Goods Photo Proof (Final Step):</Text>
                {item.dispatchPhotoUrl ? (
                  <View style={styles.photoBox}>
                    <Image source={{ uri: item.dispatchPhotoUrl }} style={styles.photoThumbnail} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.photoSavedText}>✓ Dispatched Photo Stored</Text>
                      <TouchableOpacity onPress={() => setViewPhotoUrl(item.dispatchPhotoUrl)}>
                        <Text style={styles.viewPhotoBtnText}>🔍 View Full Photo</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.capturePhotoBtn} onPress={() => handleCaptureGoodsPhoto(item)}>
                    <Text style={styles.capturePhotoBtnText}>📷 CAPTURE LOADED GOODS PHOTO</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.waBtn} onPress={() => handleWhatsApp(item)}>
                <Text style={styles.waBtnText}>💬 Share via WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* PHOTO CAPTURE MODAL */}
      <PhotoCaptureModal
        visible={photoModalVisible}
        onClose={() => {
          setPhotoModalVisible(false);
          setActiveDispatchForPhoto(null);
        }}
        title="📷 Dispatched Goods Photo Proof"
        onPhotoCaptured={handleSaveCapturedPhoto}
      />

      {/* FULL PHOTO VIEW MODAL */}
      {viewPhotoUrl && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setViewPhotoUrl(null)}>
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Loaded Products Photo Proof</Text>
              <Image source={{ uri: viewPhotoUrl }} style={styles.fullPhoto} resizeMode="contain" />
              <TouchableOpacity style={styles.closeBtn} onPress={() => setViewPhotoUrl(null)}>
                <Text style={styles.closeBtnText}>Close Preview</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.slate900 },
  subtitle: { fontSize: 12, color: COLORS.slate500, fontWeight: '600', marginBottom: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  headerBanner: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 12, marginBottom: 12 },
  company: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  stmtNo: { color: COLORS.bgLight, fontSize: 11, fontWeight: '700', marginTop: 2 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.slate500, marginTop: 10 },
  val: { fontSize: 13, fontWeight: '800', color: COLORS.slate900, marginTop: 2 },
  subVal: { fontSize: 11, color: '#475569', marginTop: 2, fontWeight: '600' },
  pdfBtn: { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#0F6E56', borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  pdfBtnText: { color: '#0F6E56', fontWeight: '900', fontSize: 12 },
  boxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  boxBadge: { backgroundColor: COLORS.bgLight, color: COLORS.primary, fontWeight: '900', fontSize: 11, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontFamily: 'monospace' },
  photoSection: { marginTop: 14, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12 },
  photoSectionTitle: { fontSize: 11, fontWeight: '800', color: '#1E293B' },
  photoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  photoThumbnail: { width: 50, height: 50, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  photoSavedText: { fontSize: 11, fontWeight: '800', color: '#0F6E56' },
  viewPhotoBtnText: { fontSize: 11, fontWeight: '800', color: '#0284C7', marginTop: 2 },
  capturePhotoBtn: { backgroundColor: '#0F6E56', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  capturePhotoBtnText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  waBtn: { backgroundColor: '#25D366', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  waBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  modalBg: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', width: '100%', borderRadius: 20, padding: 16, alignItems: 'center' },
  modalTitle: { fontSize: 15, fontWeight: '900', color: '#0F6E56', marginBottom: 12 },
  fullPhoto: { width: '100%', height: 260, borderRadius: 12 },
  closeBtn: { backgroundColor: '#1E293B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 14 },
  closeBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 }
});
