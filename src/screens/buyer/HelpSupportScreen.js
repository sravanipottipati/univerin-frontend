import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const QUICK_HELP = [
  { icon: 'location-outline', label: 'Track Order', msg: 'Hi, I need help tracking my order.', useIonicon: true },
  { icon: 'refresh-outline', label: 'Return & Refund', msg: 'Hi, I want to request a return or refund.', useIonicon: true },
  { icon: 'card-outline', label: 'Payment Issue', msg: 'Hi, I am facing a payment issue.', useIonicon: true },
  { icon: 'storefront-outline', label: 'Shop Issue', msg: 'Hi, I want to report an issue with a shop.', useIonicon: true },
];

const FAQS = [
  {
    q: 'How do I track my order?',
    a: 'Go to My Orders → tap your order → you can see live status updates.',
  },
  {
    q: 'Can I cancel my order?',
    a: 'You can cancel before the vendor accepts your order. Go to My Orders → Order Details → Cancel.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'Cash on Delivery (COD) and Online Payment (UPI, Cards, Net Banking) are supported.',
  },
  {
    q: 'How do I change my delivery address?',
    a: 'You can update your address during checkout before placing the order.',
  },
  {
    q: 'How do I become a vendor?',
    a: 'Register as a vendor from the signup screen. Your shop will be reviewed and approved within 24 hours.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Delivery typically takes 30–60 minutes depending on the shop and your location.',
  },
  {
    q: 'What if I receive a wrong or damaged item?',
    a: 'Contact us within 24 hours via WhatsApp or email with a photo. We will resolve it within 3–5 business days.',
  },
];

const WHATSAPP_NUMBER = '919000869619';
const SUPPORT_EMAIL   = 'contact@univerin.in';
const SUPPORT_PHONE   = '9000869619';

const openWhatsApp = (msg = 'Hi, I need help with my Univerin order.') => {
  const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(msg)}`;
  Linking.canOpenURL(url)
    .then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // fallback to web whatsapp
        Linking.openURL(
          `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
        );
      }
    })
    .catch(() => Alert.alert('Error', 'Could not open WhatsApp'));
};

const openEmail = (subject = 'Univerin Support Request') => {
  Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`)
    .catch(() => Alert.alert('Error', 'Could not open email app'));
};

const openCall = () => {
  Linking.openURL(`tel:${SUPPORT_PHONE}`)
    .catch(() => Alert.alert('Error', 'Could not open phone app'));
};

export default function HelpSupportScreen({ navigation }) {
  const [search, setSearch]         = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const filteredFaqs = FAQS.filter(f =>
    f.q.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        

        {/* Search */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search help topics"
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Quick Help */}
        <Text style={styles.sectionTitle}>Quick Help</Text>
        <View style={styles.quickGrid}>
          {QUICK_HELP.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickCard}
              onPress={() => openEmail(item.label)}
            >
              {item.useIonicon ? <Ionicons name={item.icon} size={22} color="#555" style={{marginBottom: 8}} /> : <Text style={styles.quickIcon}>{item.icon}</Text>}
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQs */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <View style={styles.faqCard}>
          {filteredFaqs.length === 0 ? (
            <View style={styles.noResult}>
              <Text style={styles.noResultText}>No results found</Text>

            </View>
          ) : (
            filteredFaqs.map((faq, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.faqItem,
                  index < filteredFaqs.length - 1 && styles.faqItemBorder,
                ]}
                onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
              >
                <View style={styles.faqRow}>
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <Text style={styles.faqArrow}>
                    {expandedFaq === index ? '▲' : '▼'}
                  </Text>
                </View>
                {expandedFaq === index && (
                  <Text style={styles.faqAnswer}>{faq.a}</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Contact Support */}
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <View style={styles.contactCard}>

          {/* Email */}
          <TouchableOpacity style={styles.contactItem} onPress={openEmail}>
            <View style={[styles.contactIconBox, { backgroundColor: '#eff6ff' }]}>
              <Text style={styles.contactIcon}>📧</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Email</Text>
              <Text style={styles.contactSub}>{SUPPORT_EMAIL}</Text>
            </View>
            <Text style={styles.contactArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.contactDivider} />

          {/* Call */}
          <TouchableOpacity style={styles.contactItem} onPress={openCall}>
            <View style={[styles.contactIconBox, { backgroundColor: '#fef9c3' }]}>
              <Text style={styles.contactIcon}>📞</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Call Us</Text>
              <Text style={styles.contactSub}>Mon–Sat, 9AM – 6PM</Text>
            </View>
            <Text style={styles.contactArrow}>›</Text>
          </TouchableOpacity>

        </View>

        {/* Address */}
        <View style={styles.addressCard}>
          <Text style={styles.addressTitle}>📍 Registered Address</Text>
          <Text style={styles.addressText}>Univerin Private Limited</Text>
          <Text style={styles.addressText}>4/11, Sankarapuram, Govindampalli</Text>
          <Text style={styles.addressText}>Obulavaripalle - 516105</Text>
          <Text style={styles.addressText}>Andhra Pradesh, India</Text>
          <Text style={styles.addressText}>GSTIN: 37AADCU8846J1ZP</Text>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
      {/* Bottom Tab */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingBottom: 20, paddingTop: 10 }}>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Home' })}>
          <Ionicons name="home-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Cart' })}>
          <Ionicons name="cart-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'MyOrders' })}>
          <Ionicons name="receipt-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('BuyerTabs', { screen: 'Profile' })}>
          <Ionicons name="person-outline" size={25} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn:     { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },

  whatsappBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#25D366', margin: 16, borderRadius: 14, padding: 16,
  },
  whatsappLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  whatsappIcon:      { fontSize: 28 },
  whatsappTitle:     { fontSize: 15, fontWeight: 'bold', color: '#fff' },
  whatsappSub:       { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  whatsappBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  whatsappBadgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    marginHorizontal: 16, marginBottom: 16, padding: 12,
  },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111' },

  sectionTitle: {
    fontSize: 15, fontWeight: 'bold', color: '#111',
    marginHorizontal: 16, marginBottom: 12, marginTop: 4,
  },

  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, marginBottom: 8,
  },
  quickCard: {
    width: '45%', backgroundColor: '#fff', borderRadius: 14,
    margin: '2.5%', padding: 16, alignItems: 'center',
  },
  quickIcon:  { fontSize: 28, marginBottom: 8 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#111', textAlign: 'center' },

  faqCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, marginBottom: 16, overflow: 'hidden',
  },
  faqItem:       { padding: 16 },
  faqItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  faqRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion:   { fontSize: 14, fontWeight: '600', color: '#111', flex: 1, paddingRight: 8 },
  faqArrow:      { fontSize: 11, color: '#9CA3AF' },
  faqAnswer:     { fontSize: 13, color: '#555', marginTop: 10, lineHeight: 20 },

  noResult:     { padding: 24, alignItems: 'center' },
  noResultText: { fontSize: 14, color: '#888', marginBottom: 8 },
  noResultLink: { fontSize: 14, color: '#25D366', fontWeight: '600' },

  contactCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, marginBottom: 16, overflow: 'hidden',
  },
  contactItem:    { flexDirection: 'row', alignItems: 'center', padding: 16 },
  contactDivider: { height: 1, backgroundColor: '#F5F5F5', marginHorizontal: 16 },
  contactIconBox: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  contactIcon:  { fontSize: 22 },
  contactInfo:  { flex: 1 },
  contactTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  contactSub:   { fontSize: 12, color: '#888' },
  contactArrow: { fontSize: 20, color: '#9CA3AF' },

  addressCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, marginBottom: 16, padding: 16,
  },
  addressTitle: { fontSize: 14, fontWeight: 'bold', color: '#111', marginBottom: 10 },
  addressText:  { fontSize: 13, color: '#555', lineHeight: 22 },
});