import { Router } from 'express';

const router: Router = Router();

const TABLE = 'anchor_accounts';

router.get('/', async (req: any, res: any) => {
  try {
    const { status, keyword, page = '1', pageSize = '20' } = req.query;
    let query = req.supabase.from(TABLE).select('*', { count: 'exact' })
      .eq('is_deleted', 'n');

    if (status && status !== 'all') query = query.eq('status', status);
    if (keyword) query = query.ilike('account_name', `%${keyword}%`);

    const offset = (Number(page) - 1) * Number(pageSize);
    query = query.order('created_at', { ascending: false }).range(offset, offset + Number(pageSize) - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ success: true, data: { list: data || [], total: count || 0 } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: any, res: any) => {
  try {
    const { data, error } = await req.supabase.from(TABLE)
      .select('*').eq('id', req.params.id).eq('is_deleted', 'n')
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: any, res: any) => {
  try {
    const { account_name, account_password, track_description, tags, interests, status } = req.body;
    if (!account_name) return res.status(400).json({ success: false, error: 'account_name is required' });

    const { data, error } = await req.supabase.from(TABLE)
      .insert([{
        account_name,
        account_password: account_password || '',
        track_description: track_description || '',
        tags: tags ? JSON.stringify(tags) : '[]',
        interests: interests ? JSON.stringify(interests) : '[]',
        status: status || 'active',
        creator_emp_id: req.user?.emp_id || '',
      }])
      .select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req: any, res: any) => {
  try {
    const updateData: Record<string, any> = {};
    const fields = ['account_name', 'account_password', 'track_description', 'tags', 'interests', 'status'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f === 'tags' || f === 'interests') {
          updateData[f] = JSON.stringify(req.body[f]);
        } else {
          updateData[f] = req.body[f];
        }
      }
    }

    const { data, error } = await req.supabase.from(TABLE)
      .update(updateData).eq('id', req.params.id).eq('is_deleted', 'n')
      .select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: any, res: any) => {
  try {
    const { error } = await req.supabase.from(TABLE)
      .update({ is_deleted: 'y' }).eq('id', req.params.id).eq('is_deleted', 'n');
    if (error) throw error;
    res.json({ success: true, data: null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
