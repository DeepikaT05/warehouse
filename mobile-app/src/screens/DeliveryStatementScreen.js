import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Image, Modal, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../theme';
import mobileApi from '../services/api';
import PhotoCaptureModal from '../components/PhotoCaptureModal';

export default function DeliveryStatementScreen({ navigation }) {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [activeDispatchForPhoto, setActiveDispatchForPhoto] = useState(null);
  const [viewPhotoUrl, setViewPhotoUrl] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchDispatches = async () => {
    try {
      setLoading(true);
      const res = await mobileApi.get('/dispatches');
      if (res.data.success) {
        setDispatches(res.data.dispatches || []);
      }
    } catch (err) {
      console.log('Error fetching dispatches:', err.message);
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
    setPhotoModalVisible(false);
    setIsUploadingPhoto(true);

    try {
      const res = await mobileApi.post('/dispatches/upload-photo', {
        dispatchId: activeDispatchForPhoto._id,
        salesInvoiceNo: activeDispatchForPhoto.salesInvoiceNo,
        photoUrl: photoData
      });

      if (res.data && res.data.success) {
        Alert.alert('✅ Photo Uploaded!', 'Dispatched goods photo proof stored successfully.');
        fetchDispatches();
      } else {
        Alert.alert('Upload Error', res.data?.message || 'Could not save photo proof.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Could not upload photo proof.';
      Alert.alert('Upload Error', msg);
    } finally {
      setIsUploadingPhoto(false);
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
        <Text style={styles.title}>Delivery Statements ({dispatches.length})</Text>
        <Text style={styles.subtitle}>Clean handover records, PDF downloads & photo proof</Text>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#0F6E56" style={{ marginTop: 30 }} />
        ) : dispatches.length === 0 ? (
          <View style={styles.card}>
            <Text style={{ textAlign: 'center', color: COLORS.slate500, fontSize: 13, padding: 10 }}>
              No delivery statements generated yet.
            </Text>
          </View>
        ) : (
          dispatches.map((item) => {
            const isExpanded = expandedId === item._id;
            const dealerName = item.dealerId?.dealerName || item.dealerId?.firmName || 'N/A';
            const boxCount = item.scannedBoxQrIds?.length || 0;
            const dateStr = new Date(item.dispatchDate || item.createdAt || Date.now()).toLocaleDateString();

            return (
              <View key={item._id} style={styles.compactCard}>
                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => setExpandedId(isExpanded ? null : item._id)}
                  style={styles.compactHeaderRow}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.badgeRow}>
                      <Text style={styles.stmtBadge}>#{item.dispatchNo}</Text>
                      <Text style={styles.invBadge}>Inv: #{item.salesInvoiceNo}</Text>
                      <Text style={styles.dateText}>{dateStr}</Text>
                    </View>
                    <Text style={styles.dealerText} numberOfLines={1}>
                      👤 {dealerName} {item.dealerId?.city ? `(${item.dealerId.city})` : ''}
                    </Text>
                  </View>

                  <View style={styles.boxCountBadge}>
                    <Text style={styles.boxCountText}>{boxCount} {boxCount === 1 ? 'Box' : 'Boxes'}</Text>
                    <Text style={styles.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.expandedSection}>
                    {item.dealerId?.address ? (
                      <Text style={styles.detailText}>
                        📍 {[item.dealerId?.address, item.dealerId?.city, item.dealerId?.state, item.dealerId?.pincode].filter(Boolean).join(', ')}
                      </Text>
                    ) : null}
                    {item.dealerId?.phone ? (
                      <Text style={styles.detailText}>📞 Phone: {item.dealerId.phone}</Text>
                    ) : null}
                    {item.dealerId?.gstNumber ? (
                      <Text style={styles.detailText}>GSTIN: {item.dealerId.gstNumber}</Text>
                    ) : null}
                    <Text style={styles.detailText}>
                      🚚 Transport: {item.courierName} ({item.vehicleNumber}) - Driver: {item.driverName}
                    </Text>

                    <Text style={[styles.detailText, { fontWeight: '800', marginTop: 6 }]}>Verified Box QRs:</Text>
                    <View style={styles.boxGrid}>
                      {item.scannedBoxQrIds?.map((qr, idx) => (
                        <Text key={idx} style={styles.boxBadge}>{qr}</Text>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.actionBar}>
                  {item.dispatchPhotoUrl ? (
                    <TouchableOpacity 
                      style={styles.photoChipSuccess} 
                      onPress={() => setViewPhotoUrl(item.dispatchPhotoUrl)}
                    >
                      <Image source={{ uri: item.dispatchPhotoUrl }} style={styles.thumbImage} />
                      <Text style={styles.photoChipTextSuccess}>✓ Photo Proof</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.photoChipPending} 
                      onPress={() => handleCaptureGoodsPhoto(item)}
                    >
                      <Text style={styles.photoChipTextPending}>📷 Add Photo</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.pdfChip}
                    onPress={() => Linking.openURL(`https://warehouse.vanikicrop.com/api/dispatches/${item._id}/pdf`)}
                  >
                    <Text style={styles.pdfChipText}>📄 PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.waChip}
                    onPress={() => handleWhatsApp(item)}
                  >
                    <Text style={styles.waChipText}>💬 WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {isUploadingPhoto && (
        <Modal visible transparent animationType="fade">
          <View style={styles.uploadingOverlay}>
            <View style={styles.uploadingCard}>
              <ActivityIndicator size="large" color="#0F6E56" />
              <Text style={styles.uploadingTitle}>Uploading Photo Proof...</Text>
              <Text style={styles.uploadingSubtitle}>Storing loaded goods image safely in cloud server</Text>
            </View>
          </View>
        </Modal>
      )}

      <PhotoCaptureModal
        visible={photoModalVisible}
        onClose={() => {
          setPhotoModalVisible(false);
          setActiveDispatchForPhoto(null);
        }}
        title="📷 Dispatched Goods Photo Proof"
        onPhotoCaptured={handleSaveCapturedPhoto}
      />

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
  scroll: { padding: 14 },
  title: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  compactCard: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10, overflow: 'hidden' },
  compactHeaderRow: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  stmtBadge: { backgroundColor: '#0F6E56', color: '#FFF', fontSize: 11, fontWeight: '900', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  invBadge: { backgroundColor: '#F1F5F9', color: '#1E293B', fontSize: 11, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  dateText: { fontSize: 10, color: '#94A3B8', fontWeight: '600', marginLeft: 'auto' },
  dealerText: { fontSize: 12, fontWeight: '800', color: '#1E293B', marginTop: 2 },
  boxCountBadge: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', marginLeft: 8 },
  boxCountText: { fontSize: 11, fontWeight: '900', color: '#065F46' },
  expandChevron: { fontSize: 9, color: '#065F46', marginTop: 1 },
  expandedSection: { paddingHorizontal: 12, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
  detailText: { fontSize: 11, color: '#475569', marginTop: 3, fontWeight: '600' },
  boxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  boxBadge: { backgroundColor: '#E2E8F0', color: '#0F6E56', fontWeight: '900', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontFamily: 'monospace' },
  actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FAFAFA', gap: 6 },
  photoChipSuccess: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, gap: 5 },
  photoChipTextSuccess: { color: '#065F46', fontWeight: '800', fontSize: 11 },
  photoChipPending: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  photoChipTextPending: { color: '#92400E', fontWeight: '800', fontSize: 11 },
  thumbImage: { width: 16, height: 16, borderRadius: 4 },
  pdfChip: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  pdfChipText: { color: '#0F172A', fontWeight: '800', fontSize: 11 },
  waChip: { backgroundColor: '#25D366', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  waChipText: { color: '#FFF', fontWeight: '900', fontSize: 11 },
  uploadingOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  uploadingCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 24, alignItems: 'center', width: '85%', shadowColor: '#000', shadowOpacity: 0.3, elevation: 8 },
  uploadingTitle: { fontSize: 14, fontWeight: '900', color: '#0F6E56', marginTop: 14 },
  uploadingSubtitle: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 4, textAlign: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', width: '100%', borderRadius: 20, padding: 16, alignItems: 'center' },
  modalTitle: { fontSize: 14, fontWeight: '900', color: '#0F6E56', marginBottom: 12 },
  fullPhoto: { width: '100%', height: 260, borderRadius: 12 },
  closeBtn: { backgroundColor: '#1E293B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 14 },
  closeBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 }
});
