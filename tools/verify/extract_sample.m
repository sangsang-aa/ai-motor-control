% extract_sample.m — 用样例(MCB p-code)估计器在给定信号上取数,导出 CSV 供 TS 对比。
% 依赖: MATLAB + Motor Control Blockset (mcb.internal.estimatePMSMLd/Lq)。
% 变量(由调用方在 -batch 前设置,均有默认值):
%   outDir, motorRs, motorLd, motorLq, injFreq, Ts, nSamp, gate
if ~exist('outDir','var'),  outDir  = 'D:/pe_work/cmp_out'; end
if ~exist('motorRs','var'), motorRs = 0.12952;    end
if ~exist('motorLd','var'), motorLd = 114.82e-6;  end
if ~exist('motorLq','var'), motorLq = 116.25e-6;  end
if ~exist('injFreq','var'), injFreq = 500;        end
if ~exist('Ts','var'),      Ts      = 1/20000;    end
if ~exist('nSamp','var'),   nSamp   = 4000;       end
if ~exist('gate','var'),    gate    = 80;         end
if ~exist(outDir,'dir'), mkdir(outDir); end

w = 2*pi*injFreq;
t = (0:nSamp-1)'*Ts;
R = motorRs;

Zd = hypot(R, w*motorLd);
phid = atan2(w*motorLd, R);
Vd = sin(w*t);
Id = (1/Zd)*sin(w*t - phid);
clear functions
Ld = NaN;
for k = 1:nSamp
    [Ld, ph, st] = mcb.internal.estimatePMSMLd(true, Id(k), Vd(k), injFreq, Ts, R, (k>gate), 0);
end
csvwrite(fullfile(outDir,'sig_ld.csv'), [t, Vd, Id]);

Zq = hypot(R, w*motorLq);
phiq = atan2(w*motorLq, R);
Vq = sin(w*t);
Iq = (1/Zq)*sin(w*t - phiq);
clear functions
Lq = NaN;
for k = 1:nSamp
    [Lq, ph, st] = mcb.internal.estimatePMSMLq(true, Iq(k), Vq(k), injFreq, Ts, R, (k>gate), 0);
end
csvwrite(fullfile(outDir,'sig_lq.csv'), [t, Vq, Iq]);

fid = fopen(fullfile(outDir,'sample_results.txt'),'w');
fprintf(fid,'ts=%.12g\n', Ts);
fprintf(fid,'R=%.12g\n', R);
fprintf(fid,'Ld_true=%.12g\nLd_sample=%.12g\n', motorLd, Ld);
fprintf(fid,'Lq_true=%.12g\nLq_sample=%.12g\n', motorLq, Lq);
fclose(fid);
disp('EXTRACT DONE');
