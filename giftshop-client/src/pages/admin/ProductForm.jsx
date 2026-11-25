import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ImagePlus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage, fieldErrors, imageUrl } from '../../api/client';
import useTitle from '../../hooks/useTitle';
import { Field, PageLoader, Spinner } from '../../components/ui';
import { OCCASIONS, RECIPIENTS } from '../../utils/constants';

const EMPTY = { name: '', description: '', price: '', discountPrice: '', category: '', stock: '', occasions: [], recipients: [], images: [], variants: [], isFeatured: false };

export default function ProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  useTitle(editing ? 'Edit product' : 'New product');
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(editing);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageLink, setImageLink] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get('/products/meta').then((r) => setCategories(r.data.categories)).catch(() => {});
    if (!editing) return;
    api.get(`/products/${id}`)
      .then(({ data: { product: p } }) => setForm({
        name: p.name, description: p.description, price: String(p.price), discountPrice: p.discountPrice != null ? String(p.discountPrice) : '',
        category: p.category, stock: String(p.stock), occasions: p.occasions, recipients: p.recipients, images: p.images,
        variants: p.variants.map((v) => ({ name: v.name, priceDelta: String(v.priceDelta) })), isFeatured: p.isFeatured,
      }))
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, editing]);

  if (loading) return <PageLoader />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const toggleIn = (k, v) => setForm({ ...form, [k]: form[k].includes(v) ? form[k].filter((x) => x !== v) : [...form[k], v] });

  const upload = async (files) => {
    if (!files?.length) return;
    if (form.images.length + files.length > 8) { toast.error('A product can have up to 8 images'); return; }
    const body = new FormData();
    [...files].forEach((f) => body.append('images', f));
    setUploading(true);
    try {
      const { data } = await api.post('/uploads', body);
      setForm((f) => ({ ...f, images: [...f.images, ...data.images.map((i) => i.path)] }));
      toast.success('Images uploaded');
    } catch (err) { toast.error(errorMessage(err)); } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addLink = () => {
    const url = imageLink.trim();
    if (!/^https:\/\/\S+$/.test(url)) { toast.error('Paste a link that starts with https://'); return; }
    setForm({ ...form, images: [...form.images, url] });
    setImageLink('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (form.name.trim().length < 2) local.name = 'Enter a name';
    if (form.description.trim().length < 10) local.description = 'Write at least 10 characters';
    if (!(Number(form.price) > 0)) local.price = 'Enter a price above 0';
    if (form.discountPrice && !(Number(form.discountPrice) < Number(form.price))) local.discountPrice = 'Must be lower than the price';
    if (form.category.trim().length < 2) local.category = 'Enter a category';
    if (form.stock === '' || Number(form.stock) < 0 || !Number.isInteger(Number(form.stock))) local.stock = 'Enter a whole number, 0 or more';
    if (form.variants.some((v) => !v.name.trim())) local.variants = 'Every option needs a name';
    setErrors(local);
    if (Object.keys(local).length) { toast.error('Check the highlighted fields'); return; }

    const body = {
      name: form.name.trim(), description: form.description.trim(), price: Number(form.price),
      discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
      category: form.category.trim(), stock: Number(form.stock), occasions: form.occasions, recipients: form.recipients,
      images: form.images, isFeatured: form.isFeatured,
      variants: form.variants.map((v) => ({ name: v.name.trim(), priceDelta: Number(v.priceDelta) || 0 })),
    };
    setSaving(true);
    try {
      if (editing) await api.put(`/products/${id}`, body);
      else await api.post('/products', body);
      toast.success(editing ? 'Product saved' : 'Product created');
      navigate('/admin/products');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally { setSaving(false); }
  };

  const input = (k, label, props = {}) => (
    <Field label={label} id={`f-${k}`} error={errors[k]}>
      <input id={`f-${k}`} className="input" value={form[k]} onChange={set(k)} aria-invalid={Boolean(errors[k])} {...props} />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate>
      <Link to="/admin/products" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft className="h-4 w-4" />All products</Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">{editing ? 'Edit product' : 'New product'}</h1>
        <button type="submit" className="btn-primary" disabled={saving}>{saving && <Spinner className="h-4 w-4" />}{editing ? 'Save product' : 'Create product'}</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card grid gap-4 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2">{input('name', 'Name', { maxLength: 120 })}</div>
            <div className="sm:col-span-2">
              <Field label="Description" id="f-description" error={errors.description}>
                <textarea id="f-description" className="input min-h-28" maxLength={2000} value={form.description} onChange={set('description')} />
              </Field>
            </div>
            {input('price', 'Price (₹)', { type: 'number', min: 1, step: '0.01', inputMode: 'decimal' })}
            {input('discountPrice', 'Sale price (₹, optional)', { type: 'number', min: 1, step: '0.01', inputMode: 'decimal' })}
            {input('category', 'Category', { list: 'cats', maxLength: 50 })}
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            {input('stock', 'Stock', { type: 'number', min: 0, step: 1, inputMode: 'numeric' })}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.isFeatured} onChange={set('isFeatured')} className="h-4 w-4 accent-[#9B4A5F]" />Show in "Our favourites" on the home page
            </label>
          </section>

          <section className="card p-6">
            <h2 className="mb-1 text-xl">Options</h2>
            <p className="mb-4 text-sm text-muted">Sizes or colours. Use the price difference for options that cost more or less (e.g. 200 or -100).</p>
            {errors.variants && <p className="field-error mb-3" role="alert">{errors.variants}</p>}
            <div className="space-y-2">
              {form.variants.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <label className="sr-only" htmlFor={`vn-${i}`}>Option name</label>
                  <input id={`vn-${i}`} className="input" placeholder="Large" maxLength={40} value={v.name}
                    onChange={(e) => setForm({ ...form, variants: form.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <label className="sr-only" htmlFor={`vp-${i}`}>Price difference</label>
                  <input id={`vp-${i}`} className="input w-36" type="number" placeholder="+ ₹0" value={v.priceDelta}
                    onChange={(e) => setForm({ ...form, variants: form.variants.map((x, j) => (j === i ? { ...x, priceDelta: e.target.value } : x)) })} />
                  <button type="button" className="btn-ghost p-2" aria-label="Remove option" onClick={() => setForm({ ...form, variants: form.variants.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-outline btn-sm mt-3" onClick={() => setForm({ ...form, variants: [...form.variants, { name: '', priceDelta: '0' }] })}>Add option</button>
          </section>

          <section className="card grid gap-6 p-6 sm:grid-cols-2">
            {[['occasions', 'Occasions', OCCASIONS], ['recipients', "Who it's for", RECIPIENTS]].map(([k, title, opts]) => (
              <fieldset key={k}>
                <legend className="mb-3 font-display text-xl">{title}</legend>
                <div className="flex flex-wrap gap-2">
                  {opts.map((o) => (
                    <label key={o} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${form[k].includes(o) ? 'border-plum bg-plum text-cream dark:border-cream dark:bg-cream dark:text-plum' : 'border-line'}`}>
                      <input type="checkbox" className="sr-only" checked={form[k].includes(o)} onChange={() => toggleIn(k, o)} />{o}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </section>
        </div>

        <section className="card h-fit p-6">
          <h2 className="mb-4 text-xl">Images</h2>
          {form.images.length > 0 && (
            <ul className="mb-4 grid grid-cols-3 gap-2">
              {form.images.map((src, i) => (
                <li key={src} className="relative">
                  <img src={imageUrl(src)} alt={`Product image ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                  {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-plum px-1.5 text-[10px] font-semibold text-cream">Main</span>}
                  <button type="button" className="absolute right-1 top-1 rounded-full bg-surface p-1 shadow" aria-label={`Remove image ${i + 1}`}
                    onClick={() => setForm({ ...form, images: form.images.filter((x) => x !== src) })}><X className="h-3 w-3" /></button>
                </li>
              ))}
            </ul>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" id="files" onChange={(e) => upload(e.target.files)} />
          <label htmlFor="files" className={`btn-outline w-full cursor-pointer ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
            {uploading ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}Upload images
          </label>
          <p className="mt-2 text-xs text-muted">JPG, PNG or WEBP, up to 2 MB each. The first image is the main one.</p>
          <div className="mt-4 rounded-xl bg-bg p-3 text-xs text-muted">
            <p className="font-semibold text-ink">For a consistent shop</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>Square photos, at least 800 × 800</li>
              <li>A plain white or cream background for the main photo</li>
              <li>The product centred and filling most of the frame</li>
              <li>Lifestyle or close-up shots as the second and third photos</li>
            </ul>
          </div>
          <div className="mt-4 flex gap-2">
            <label htmlFor="imglink" className="sr-only">Image link</label>
            <input id="imglink" className="input py-2" placeholder="or paste an image link" value={imageLink} onChange={(e) => setImageLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
            <button type="button" className="btn-outline btn-sm" onClick={addLink}>Add</button>
          </div>
        </section>
      </div>
    </form>
  );
}
